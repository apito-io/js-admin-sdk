import { defineConfig } from 'tsup';

const banner = {
  js: '// @apito-io/js-admin-sdk - Admin SDK for Apito GraphQL API',
};

const shared = {
  splitting: false,
  sourcemap: true,
  minify: true,
  dts: true,
  clean: true,
  external: ['react', 'react-dom', '@tanstack/react-query', 'graphql'],
  banner,
} as const;

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      react: 'src/react/index.ts',
      ui: 'src/ui/index.ts',
    },
    format: ['esm'],
    platform: 'browser',
    target: 'es2022',
    outDir: 'dist',
    outExtension: () => ({ js: '.mjs' }),
    noExternal: ['axios'],
    ...shared,
  },
  {
    entry: {
      index: 'src/index.ts',
      react: 'src/react/index.ts',
      ui: 'src/ui/index.ts',
    },
    format: ['cjs'],
    platform: 'node',
    target: 'es2020',
    outDir: 'dist',
    external: ['axios', 'react', 'react-dom', '@tanstack/react-query', 'graphql'],
    ...shared,
    dts: false,
  },
]);
