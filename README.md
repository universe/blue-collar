# Blue Collar
## Hard Working Worker Classes

Move any method on any class off the main thread. Typescript supported out of the box.

### Require
```ts
const { default: WorkerClass, worker, main } = require('blue-collar');

export default class BackgroundCounter extends WorkerClass(__filename) {
  #counter = 0;
  @worker async getCounter() { return this.counter; }
  @worker async increment() { return ++this.counter; }
  @worker async decrement() { return --this.counter; }
}
```

### Import
```ts
import WorkerClass, { worker, main } from 'blue-collar';

export default class BackgroundCounter extends WorkerClass(import.meta.url) {
  #counter = 0;
  @worker async getCounter() { return this.counter; }
  @worker async increment() { return ++this.counter; }
  @worker async decrement() { return --this.counter; }
}
```

### Usage
Use it just like any other class!
```ts
import BackgroundCounter from './BackgroundCounter.ts';

const counter = new BackgroundCounter();
console.log(await counter.getCounter()); // 0
await counter.increment();
await counter.increment();
await counter.decrement();
console.log(await counter.getCounter()); // 1
```

There are five (6) rules to keep in mind when writing WorkerClass utilities:
1. Your worker class must be the default export of its file.
2. Worker classes must extend `WorkerClass(import.meta.url)` (ES2020) or `WorkerClass(__filename)` (CommonJS).
3. Methods you want to kick to the background must use the `@worker` decorator, or be initialized with the `WorkerClass.worker(this.myMethod)` static helper in the constructor.
4. Methods you want to ensure always run in the main thread must use the `@main` decorator, or be initialized with the `WorkerClass.main(this.myMethod)` static helper in the constructor.
5. Methods with no decorator will be run in the thread they are called in.
6. Any constructor arguments you want to make available to the worker instance must be passed to the `super()` call in your constructor.

And three (3) important concepts to keep in mind:
1. Imports must have no side effects, unless you want some very weird behavior (this is an anti-pattern anyway). Remember: your file will always be imported twice! Once in the main thread, and once in the worker.
2. Your worker and main class instances maintain their own state, which is not automatically synced (unlike my [electron-state](https://www.npmjs.com/package/electron-state) utility). This includes both module globals, and instance parameters.
3. Each WorkerClass instance is backed by a single worker thread, and every new instance will create a new thread! Create new instances conservatively, and if you have a long lived application, make sure you clean up after yourself with `WorkerThread.terminate(myInstance)`.

### Static Method Utilities

The `blue-collar` package exposes a number of static methods on the main `WorkerClass` class to help you write better worker thread utility classes.

#### `WorkerClass.terminate(instance: WorkerClass): void`
Force an instance to terminate its worker thread. This will allow the WorkerClass instance to be garbage collected later.

```ts
import WorkerThread from 'blue-collar';
import BackgroundCounter from './BackgroundCounter.ts';

const counter = new BackgroundCounter();
WorkerThread.terminate(counter);
```

#### `WorkerClass.isMain(): boolean`
Returns `true` if called in the main thread. Returns `false` is called in a worker thread. Useful for thread-specific logic.

```ts
import WorkerClass, { worker, main } from 'blue-collar';

export default class MyClass extends WorkerClass(import.meta.url) {
  @worker async workerLog() { console.log(WorkerClass.isMain()) } // Logs: false
  @main async mainLog() { console.log(WorkerClass.isMain()) } // Logs: true
}
```

#### `WorkerClass.isWorker(): boolean`
Returns `false` if called in the main thread. Returns `true` is called in a worker thread. Useful for thread-specific logic.

```ts
import WorkerClass, { worker, main } from 'blue-collar';

export default class MyClass extends WorkerClass(import.meta.url) {
  @worker async workerLog() { console.log(WorkerClass.isWorker()) } // Logs: true
  @main async mainLog() { console.log(WorkerClass.isWorker()) } // Logs: false
}
```

#### `WorkerClass.worker(func: Function): typeof func`
A class method version of the `@worker` decorator. Useful in environments where you can not use the decorator syntax to designate worker methods.

```ts
import WorkerClass, { worker, main } from 'blue-collar';

export default class MyClass extends WorkerClass(import.meta.url) {
  constructor() {
    super();
    this.runInWorker = WorkerClass.worker(this.runInWorker);
  }
  async runInWorker() { console.log(WorkerClass.isWorker()) } // Logs: true
}
```

#### `WorkerClass.main(func: Function): typeof func`
A class method version of the `@main` decorator. Useful in environments where you can not use the decorator syntax to designate worker methods.

```ts
import WorkerClass, { worker, main } from 'blue-collar';

export default class MyClass extends WorkerClass(import.meta.url) {
  constructor() {
    super();
    this.runInMain = WorkerClass.worker(this.runInMain);
  }
  async runInMain() { console.log(WorkerClass.runInMain()) } // Logs: true
}
```