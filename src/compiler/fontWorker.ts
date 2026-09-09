/// <reference lib="webworker" />
/**
 * Dedicated Worker host for fontTools. Loads the same-origin Pyodide copied to
 * /pyodide/ by the Vite build on the first request. One request at a time.
 */
import { loadPyodide, type PyodideInterface } from 'pyodide';
import {
  compileFace,
  errorMessage,
  inspectFont,
  type WorkerRequest,
  type WorkerResponse,
} from './fontTools';

let runtime: Promise<PyodideInterface> | undefined;

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  let response: WorkerResponse;
  const transfer: Transferable[] = [];
  try {
    runtime ??= loadPyodide({
      indexURL: new URL('/pyodide/', self.location.origin).href,
      packages: ['fonttools'],
    });
    const py = await runtime;
    if (e.data.kind === 'inspect') {
      response = { ok: true, result: await inspectFont(py, e.data.bytes) };
    } else {
      const face = await compileFace(py, e.data.bytes, e.data.request);
      response = { ok: true, result: face };
      transfer.push(face.bytes.buffer as ArrayBuffer);
    }
  } catch (err) {
    response = { ok: false, message: errorMessage(err) };
  }
  self.postMessage(response, transfer);
};
