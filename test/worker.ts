import WorkerClass, { main, worker } from '../src/index.js';

export default class MyWorker extends WorkerClass(__filename) {
  counter = 0;
  constructor(init = 0) { super(init); this.counter = init; }
  @worker async getWorkerCounter() { return this.counter; }
  @main async getMainCounter() { return this.counter; }
  @worker async incrementWorkerCounter() { return ++this.counter; }
  @main async incrementMainCounter() { return ++this.counter; }
  @main async throwInMain() { throw new Error('Thrown in main.'); }
  @main async throwInWorker() { throw new Error('Thrown in worker.'); }
}
