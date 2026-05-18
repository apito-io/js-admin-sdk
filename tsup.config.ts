import { defineConfig } from 'tsup';

const banner = {
  js: '// @apito-io/js-admin-sdk - Admin SDK for Apito GraphQL API',
};

export default defineConfig([
  // ESM for browsers, Astro, Cloudflare Workers, Vite — bundle axios (no Node require chain).
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    platform: 'browser',
    target: 'es2022',
    outDir: 'dist',
    outExtension: () => ({ js: '.mjs' }),
    splitting: false,
    sourcemap: true,
    minify: true,
    dts: true,
    clean: true,
    noExternal: ['axios'],
    banner,
  },
  // CJS for Node scripts — axios remains a normal dependency.
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    platform: 'node',
    target: 'es2020',
    outDir: 'dist',
    splitting: false,
    sourcemap: true,
    minify: true,
    external: ['axios'],
    banner,
  },
]);
