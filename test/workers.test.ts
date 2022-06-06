/* global describe, it */
import * as assert from 'assert';
import MyWorker from './worker.js';
import DefaultExport, { WorkerClass as NamedExport } from '../src/index.js';

let worker: MyWorker;
describe('Runs Tests', function() {
  this.beforeEach(() => { worker = new MyWorker(); });
  this.afterEach(() => { MyWorker.terminate(worker); });

  it('initializes', async function() {
    this.timeout(1000);
    assert.strictEqual(await worker.getMainCounter(), 0);
    assert.strictEqual(await worker.getWorkerCounter(), 0);
  });

  it('calls main process methods', async function() {
    assert.strictEqual(await worker.getMainCounter(), 0);
    assert.strictEqual(await worker.getWorkerCounter(), 0);
    await worker.incrementMainCounter();
    assert.strictEqual(await worker.getMainCounter(), 1);
    assert.strictEqual(await worker.getWorkerCounter(), 0);
  });

  it('calls worker process methods', async function() {
    const worker = new MyWorker();
    assert.strictEqual(await worker.getMainCounter(), 0);
    assert.strictEqual(await worker.getWorkerCounter(), 0);
    await worker.incrementWorkerCounter();
    assert.strictEqual(await worker.getMainCounter(), 0);
    assert.strictEqual(await worker.getWorkerCounter(), 1);
  });

  it('calls worker process with constructor args', async function() {
    const worker = new MyWorker(10);
    assert.strictEqual(await worker.getMainCounter(), 10);
    assert.strictEqual(await worker.getWorkerCounter(), 10);
    await worker.incrementWorkerCounter();
    assert.strictEqual(await worker.getMainCounter(), 10);
    assert.strictEqual(await worker.getWorkerCounter(), 11);
  });

  it('Environment Test Variables', async function() {
    assert.strictEqual(MyWorker.isMain, true);
    assert.strictEqual(MyWorker.isWorker, false);
    assert.strictEqual(DefaultExport.isMain, true);
    assert.strictEqual(DefaultExport.isWorker, false);
    assert.strictEqual(NamedExport.isMain, true);
    assert.strictEqual(NamedExport.isWorker, false);
  });

  it('Handles throwing in main', async function() {
    assert.strictEqual(await worker.getMainCounter(), 0);
    await worker.incrementMainCounter();
    assert.strictEqual(await worker.getMainCounter(), 1);
    await assert.rejects(async() => await worker.throwInMain(), new Error('Thrown in main.'));
    assert.strictEqual(await worker.getMainCounter(), 1);
    await worker.incrementMainCounter();
    assert.strictEqual(await worker.getMainCounter(), 2);
  });

  it('Handles throwing in worker', async function() {
    assert.strictEqual(await worker.getWorkerCounter(), 0);
    await worker.incrementWorkerCounter();
    assert.strictEqual(await worker.getWorkerCounter(), 1);
    await assert.rejects(async() => await worker.throwInWorker(), new Error('Thrown in worker.'));
    assert.strictEqual(await worker.getWorkerCounter(), 1);
    await worker.incrementWorkerCounter();
    assert.strictEqual(await worker.getWorkerCounter(), 2);
  });
});
