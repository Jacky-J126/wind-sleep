import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8888',
      '/stream': { target: 'ws://localhost:8888', ws: true },
      '/tts': 'http://localhost:8888',
    },
  },
});
