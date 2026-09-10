import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5180, strictPort: true },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        // art.html is a development tool, not part of the game.
        main: 'index.html',
        art: 'art.html',
      },
    },
  },
});
