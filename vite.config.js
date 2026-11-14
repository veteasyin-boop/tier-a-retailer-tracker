import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  define: command === 'serve'
    ? { __LEGACY_MANAGER_PIN__: JSON.stringify(process.env.LEGACY_MANAGER_PIN || '') }
    : {},
  server: {
    port: 3000,
    host: true,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
}));
