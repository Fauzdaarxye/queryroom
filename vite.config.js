import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', rollupOptions: { output: { manualChunks(id) {
    if (id.includes('node_modules/@codemirror') || id.includes('node_modules/@lezer') || id.includes('node_modules/codemirror')) return 'editor';
    if (id.includes('node_modules/react')) return 'react';
  } } } },
});
