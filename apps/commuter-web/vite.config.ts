import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/trips': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/bookings': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/vehicles': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/route': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/wallet': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/carbon': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/fair-split': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/safety': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/otp': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/sos': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
