import { defineConfig } from 'vite';

// base './' で GitHub Pages / Vercel どちらのサブパス配信でも動く静的ビルドにする
export default defineConfig({
  base: './',
  // 開発サーバの監視から、元素材と資料を外す（ユーザーが素材をコピーしている最中に EBUSY で落ちたことがある。2026-10-04）
  server: { port: 5180, watch: { ignored: ['**/_src_assets/**', '**/docs/**'] } },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
});
