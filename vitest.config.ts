import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@motor': fileURLToPath(new URL('../simulacion-procesos/app/src', import.meta.url)) } },
  test: { testTimeout: 60000 },
});
