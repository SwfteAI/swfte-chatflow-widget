import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    outDir: 'dist',
    external: ['react', 'react-dom'],
  },
  {
    entry: { index: 'src/react/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    outDir: 'react',
    external: ['react', 'react-dom'],
  },
  {
    entry: { index: 'src/next/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    outDir: 'dist/next',
    external: ['react', 'react-dom', 'next'],
  },
]);
