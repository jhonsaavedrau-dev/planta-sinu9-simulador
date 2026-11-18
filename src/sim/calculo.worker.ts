/// <reference lib="webworker" />
import { simular, type Entradas } from './planta';

self.onmessage = (ev: MessageEvent<{ id: number; entradas: Entradas }>) => {
  const r = simular(ev.data.entradas);
  (self as DedicatedWorkerGlobalScope).postMessage({ id: ev.data.id, resultado: r });
};
