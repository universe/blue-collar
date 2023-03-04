/* eslint-disable no-new */
import { workerData } from 'worker_threads';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Worker = (await import(workerData[0]))?.default;
new Worker(...workerData[1]);
