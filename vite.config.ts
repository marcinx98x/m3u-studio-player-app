import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const proxyTarget =
    env.VITE_DEV_PROXY_TARGET?.trim() || 'https://m3u-studio.marcincloud.org';
  const rawBase = (env.VITE_BASE_PATH || '/').trim() || '/';
  const base = rawBase === '/' ? '/' : rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

  return {
    base,
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
        },
        // Root Xtream media aliases (same as public/.htaccess on studio)
        '/live': {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
        },
        '/movie': {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
        },
        '/series': {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
        },
        '/timeshift': {
          target: proxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});
