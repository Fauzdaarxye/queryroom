import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('../dist', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/@codemirror') ||
            id.includes('node_modules/@lezer') ||
            id.includes('node_modules/codemirror')
          )
            return 'editor';
          if (id.includes('node_modules/react')) return 'react';
        },
      },
    },
  },
});
