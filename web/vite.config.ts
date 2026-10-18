import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = process.env.BACKEND_URL ?? 'http://localhost:4100';

// The dev server proxies backend paths so cookies stay first-party on :5180.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180, strictPort: true,
    proxy: {
      '/api': backend,
      '/auth': backend,
    },
  },
});
