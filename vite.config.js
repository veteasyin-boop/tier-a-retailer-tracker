import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    // This local-only value is never injected into production builds.
    define: command === 'serve'
      ? { __LEGACY_MANAGER_PIN__: JSON.stringify(env.LEGACY_MANAGER_PIN || process.env.LEGACY_MANAGER_PIN || '') }
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
  };
});
