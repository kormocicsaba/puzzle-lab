import { defineConfig } from 'vite';

// Multi-page: a hub plus one page per game. Relative base so the build can be
// hosted from any sub-path (artifact, Cloudflare Pages, a phone on the LAN).
export default defineConfig({
  base: './',
  server: { port: 5190, strictPort: true, host: true },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        index: 'index.html',
        sushi: 'sushi.html',
        ducks: 'ducks.html',
        moving: 'moving.html',
      },
    },
  },
});
