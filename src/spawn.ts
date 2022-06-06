/* eslint-disable no-new */
import { workerData } from 'worker_threads';
import { fileURLToPath } from 'url';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Worker = (require(workerData[0].startsWith('file://') ? fileURLToPath(workerData[0]) : workerData[0]))?.default;
new Worker(...workerData[1]);
