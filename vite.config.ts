import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// El motor termodinámico (Peng-Robinson validado) vive en el proyecto del simulador de procesos
// y se usa tal cual: si se mejora allá, esta plataforma lo recibe al volver a construir.
const motor = fileURLToPath(new URL('../simulacion-procesos/app/src', import.meta.url));

export default defineConfig({
  base: './',
  resolve: { alias: { '@motor': motor } },
  server: { fs: { allow: ['..'] } },
  worker: { format: 'es' },
});
