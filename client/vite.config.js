import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const api = env.VITE_DEV_API_TARGET || 'http://localhost:4000';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      // In development the browser talks to Vite only; Vite forwards to the API.
      proxy: {
        '/api': { target: api, changeOrigin: true },
        '/media': { target: api, changeOrigin: true },
        '/socket.io': { target: api, changeOrigin: true, ws: true },
      },
    },
    build: { chunkSizeWarningLimit: 700 },
  };
});
