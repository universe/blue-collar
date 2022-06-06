/* eslint-disable no-use-before-define */
/* eslint-disable no-async-promise-executor */
import { Worker, WorkerOptions, isMainThread, parentPort } from 'worker_threads';
import * as path from 'path';

export const INTERNAL = '__blue-collar-state__';

function * idGen(i = 0) { while (true) { i = (i + 1) % Number.MAX_SAFE_INTEGER; yield i; } }
const uuid = idGen();

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type ANY_FUNC<This = any, Return = any, Args extends Array<any> = any[]> = (this: This, ...args: Args) => Return;

export interface StaticProps<T extends WorkerClass> { new (filePath: string): T; }
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export type WorkerClassMethod<T extends WorkerClass> = ANY_FUNC<T | StaticProps<T>, Promise<any>>;

type ExcludeSymbols<T extends string | number | bigint | boolean | null | undefined | symbol> = T extends symbol ? never : T;
type MethodProperties<T> = ExcludeSymbols<{ [K in keyof T]: T[K] extends Function ? K : never }[keyof T]>;
type MethodType = 'static' | 'instance';

type CallID<T extends WorkerClass, MethodName extends MethodProperties<T> = MethodProperties<T>> = `${MethodName}-${MethodType}-${number}`;

type WorkerInit = { type: 'init'; }

type MethodRequestData<T extends WorkerClass, MethodName extends MethodProperties<T> = MethodProperties<T>> = {
  type: 'req'
  method: MethodName;
  methodType: MethodType;
  nonce: number;
  data: T[MethodName] extends ANY_FUNC ? Parameters<T[MethodName]> : never;
  error: Error | null;
}

type MethodResponseData<T extends WorkerClass, MethodName extends MethodProperties<T> = MethodProperties<T>> = {
  type: 'res'
  method: MethodName;
  methodType: 'static' | 'instance';
  nonce: number;
  data: (T[MethodName] extends ANY_FUNC ? ReturnType<T[MethodName]> : never) | null;
  error: Error | null;
}

type TypedCallbacks<T extends WorkerClass, MethodName extends MethodProperties<T> = MethodProperties<T>> = {
  [id in CallID<T, MethodName>]: ((
    res: null | (id extends `${infer R}-${number}`
      ? R extends MethodProperties<T>
        ? T[R] extends ANY_FUNC
          ? ReturnType<T[R]>
          : never
        : never
      : never),
    error: Error | null,
  ) => unknown);
}

// class Bar extends WorkerClass {
//   a() { return 1; }
//   b() { return '2'; }
//   c = 1;
// }

// type barKeys = MethodProperties<Bar>;
// // type func = ReturnType<Bar[barKeys]>;

// const foo: TypedCallbacks<Bar> = {
//   'a-instance-123': (a: number) => { a; },
//   // 'a-456': (a: string) => { a; }, // Should fail type-check
//   'b-123': (a: string) => { a; },
//   'b-456': (a: string) => { a; },
//   // 'b-789': (a: number) => { a; }, // Should fail type-check
//   // 'c-123': (a: string) => { a; }, // Should fail type-check when above lines are commented out
// }

export interface InternalWorkerClassState<T extends WorkerClass> {
  name: string;
  worker: Worker | null;
  timeout: NodeJS.Timeout | null;
  generation: number;
  initialized: Promise<void>;
  animationFrameRef: number;
  callbacks: TypedCallbacks<T>;
}

export class WorkerClass {
  [INTERNAL]: InternalWorkerClassState<this>;

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  constructor(filePath: string, args: any[] = [], options?: WorkerOptions) {
    let resolveInit: () => void;
    this[INTERNAL] = {
      name: '',
      worker: null,
      timeout: null,
      generation: 0,
      initialized: new Promise(resolve => resolveInit = resolve),
      animationFrameRef: 0,
      callbacks: {} as TypedCallbacks<this>,
    };
    if (isMainThread) {
      this[INTERNAL].worker = new Worker(path.join(path.dirname(__filename), 'spawn.js'), {
        ...options,
        workerData: [ filePath, args ],
      });
      this[INTERNAL].worker?.unref();
      process.on('exit', () => WorkerClass.terminate(this));
    }
    const port = isMainThread ? this[INTERNAL].worker : parentPort;
    port?.on('message', async(message: WorkerInit | MethodRequestData<typeof this> | MethodResponseData<typeof this>) => {
      if (message.type === 'init') { resolveInit(); }
      else if (message.type === 'req') {
        const func = this[message.method] as unknown as Function; // This shouldn't be needed...
        const res: MethodResponseData<this, typeof message.method> = {
          type: 'res',
          methodType: message.methodType,
          method: message.method,
          nonce: message.nonce,
          data: null,
          error: null,
        };
        try { res.data = await func.apply(this, message.data); }
        catch (err) { res.error = err; }
        port?.postMessage(res);
      }
      else {
        this[INTERNAL].callbacks[`${message.method}-${message.methodType}-${message.nonce}`](message.data, message.error);
      }
    });
    if (!isMainThread) {
      port?.postMessage({ type: 'init' });
    }
  }

  static get isMain() { return isMainThread; }
  static get isWorker() { return !isMainThread; }
  static terminate(instance: WorkerClass) { instance[INTERNAL].worker?.terminate(); }

  static main<T extends WorkerClass>(this: StaticProps<WorkerClass>, func: WorkerClassMethod<T>): typeof func {
    if (isMainThread) { return func; }
    const funcName = `${func.name}MainProxy`;
    // Jump through a couple hoops here to have a sensible function name in dev tools.
    return ({
      [funcName](this: ThisParameterType<typeof func>, ...args: Parameters<typeof func>) {
        const methodType = typeof this === 'function' ? 'static' : 'instance';
        if (methodType === 'static') {
          throw new Error(`WorkerClass decorators must be used on instance methods. Instead found class method ${(this as Function)?.name}.${func?.name}`);
        }
        const methodName = func.name as MethodProperties<T>;
        const nonce = uuid.next().value;
        if (!nonce) { throw new Error(); }
        return new Promise<ReturnType<typeof func>>((resolve, reject) => {
          this[INTERNAL].callbacks[`${methodName}-${methodType}-${nonce}`] = (res: ReturnType<typeof func>, err: Error | null = null) => {
            err ? reject(err) : resolve(res);
          };
          parentPort?.postMessage({
            type: 'req',
            methodType,
            method: methodName,
            nonce,
            data: args,
            error: null,
          } as MethodRequestData<T>);
        });
      },
    })[funcName];
  }

  static worker<T extends WorkerClass>(this: StaticProps<WorkerClass>, func: WorkerClassMethod<T>): typeof func {
    if (!isMainThread) { return func; }
    // Jump through a couple hoops here to have a sensible function name in dev tools.
    const funcName = `${func.name}WorkerProxy`;
    // Jump through a couple hoops here to have a sensible function name in dev tools.
    return ({
      [funcName](this: ThisParameterType<typeof func>, ...args: Parameters<typeof func>) {
        const methodType = typeof this === 'function' ? 'static' : 'instance';
        if (methodType === 'static') {
          throw new Error(`WorkerClass decorators must be used on instance methods. Instead found class method ${(this as Function)?.name}.${func?.name}`);
        }
        const methodName = func.name as MethodProperties<T>;
        const nonce = uuid.next().value;
        if (!nonce) { throw new Error(); }
        return new Promise<ReturnType<typeof func>>(async(resolve, reject) => {
          await this[INTERNAL].initialized;
          this[INTERNAL].callbacks[`${methodName}-${methodType}-${nonce}`] = (res: ReturnType<typeof func>, err: Error | null = null) => {
            err ? reject(err) : resolve(res);
          };
          this[INTERNAL].worker?.postMessage({
            type: 'req',
            methodType,
            method: methodName,
            nonce,
            data: args,
            error: null,
          } as MethodRequestData<T>);
        });
      },
    })[funcName];
  }
}

export { main, worker } from './decorators.js';

function WorkerClassFactory(filePath: string, options?: WorkerOptions) {
  return class ResolvedWorkerClass extends WorkerClass {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    constructor(...args: any[]) { super(filePath, args, options); }
  };
}

Object.defineProperties(WorkerClassFactory, {
  isMain: { get: () => isMainThread },
  isWorker: { get: () => !isMainThread },
});

export default WorkerClassFactory as typeof WorkerClassFactory & { get isMain(): boolean; get isWorker(): boolean; };
