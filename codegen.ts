import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: './codegen/introspection.normalized.json',
  documents: './codegen/operations/**/*.graphql',
  ignoreNoDocuments: true,
  generates: {
    'src/generated/types.ts': {
      plugins: ['typescript', 'typescript-operations'],
      config: {
        skipTypename: true,
        avoidOptionals: true,
        skipValidate: true,
      },
    },
    'src/generated/sdk.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-generic-sdk',
      ],
      config: {
        documentMode: 'string',
        skipTypename: true,
        avoidOptionals: true,
        skipValidate: true,
      },
    },
    'src/generated/hooks.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-react-query',
      ],
      config: {
        fetcher: '../generated/fetcher#useApitoFetcher',
        reactQueryVersion: 5,
        skipTypename: true,
        avoidOptionals: true,
        skipValidate: true,
        exposeFetcher: true,
        exposeQueryKeys: true,
        exposeMutationKeys: true,
      },
    },
  },
  hooks: {
    afterAllFileWrite: ['prettier --write'],
  },
};

export default config;
