import { WorkerClass, WorkerClassMethod, StaticProps } from './index.js';

export function main<T extends WorkerClass>(target: T | StaticProps<T>, key: string, descriptor: TypedPropertyDescriptor<WorkerClassMethod<T>>): void {
  if (typeof target[key] !== 'function' || !descriptor.value) {
    throw new Error(`[WorkerClass] The @main decorator must be used on an async class method. Instead applied to ${key}.`);
  }
  descriptor.value = WorkerClass.main(descriptor.value);
}

export function worker<T extends WorkerClass>(target: T | StaticProps<T>, key: string, descriptor: TypedPropertyDescriptor<WorkerClassMethod<T>>): void {
  if (typeof target[key] !== 'function' || !descriptor.value) {
    throw new Error(`[WorkerClass] The @worker decorator must be used on an async class method. Instead applied to ${key}.`);
  }
  descriptor.value = WorkerClass.worker(descriptor.value);
}
