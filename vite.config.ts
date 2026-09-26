import { defineConfig } from 'vite';

// base './' で GitHub Pages / Vercel どちらのサブパス配信でも動く静的ビルドにする
export default defineConfig({
  base: './',
  server: { port: 5180 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
});
