// Build 1 file HTML duy nhất để xem thử app trên trình duyệt (số liệu giả, không đồng bộ)
import { defineConfig, mergeConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import base from './vite.config.js';

export default mergeConfig(
  base,
  defineConfig({
    plugins: [viteSingleFile()],
    define: { 'import.meta.env.VITE_DEMO': JSON.stringify('1') },
    build: { outDir: 'preview-dist', emptyOutDir: true },
  })
);
