# Apito Admin JavaScript SDK

[![npm version](https://badge.fury.io/js/%40apito-io%2Fjs-admin-sdk.svg)](https://badge.fury.io/js/%40apito-io%2Fjs-admin-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive JavaScript SDK for communicating with Apito GraphQL API endpoints. This SDK provides both type-safe and flexible interfaces for interacting with Apito's backend services.

## 🚀 Features

- ✅ **Complete SDK Implementation**: Full implementation matching the Go SDK
- ✅ **Type-Safe Operations**: Generic typed methods for better development experience
- ✅ **GraphQL-Based**: Native GraphQL communication with Apito backend
- ✅ **Authentication Ready**: API key and tenant-based authentication
- ✅ **Promise-Based**: Modern async/await support
- ✅ **Comprehensive Error Handling**: Detailed error responses and GraphQL error support
- ✅ **Plugin-Ready**: Perfect for Node.js applications and microservices
- ✅ **Production Ready**: Battle-tested patterns and error handling

## 📦 Installation

```bash
npm install @apito-io/js-admin-sdk
```

or

```bash
yarn add @apito-io/js-admin-sdk
```

### Astro / Cloudflare Workers

API routes and middleware run in **workerd**, which has no Node `require`. Use the SDK as **ESM only**:

```typescript
import { ApitoClient } from '@apito-io/js-admin-sdk';
```

From **v3.2.0**, `dist/index.mjs` bundles axios for browser/worker runtimes so you do not pull axios’s Node CJS build (`require is not defined`).

**Tips if a bundler still resolves the wrong build:**

- Do **not** add `@apito-io/js-admin-sdk` to `vite.ssr.noExternal` (that can force the CJS entry).
- Optional Vite aliases in `astro.config.mjs`:

```javascript
import path from 'node:path';

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        '@apito-io/js-admin-sdk': path.resolve(
          'node_modules/@apito-io/js-admin-sdk/dist/index.mjs'
        ),
      },
    },
    optimizeDeps: { exclude: ['@apito-io/js-admin-sdk'] },
  },
});
```

Node scripts can still use `require('@apito-io/js-admin-sdk')` (CJS build, axios as peer dependency).

## 🎯 Quick Start

```javascript
import { ApitoClient } from '@apito-io/js-admin-sdk';

// Create a new client
const client = new ApitoClient({
  baseURL: 'https://api.apito.io/graphql',
  apiKey: 'your-api-key-here',
  timeout: 30000,
});

// Create a new todo
async function createTodo() {
  const todoData = {
    title: 'Learn Apito SDK',
    description: 'Complete the SDK tutorial',
    status: 'todo',
    priority: 'high',
  };

  const request = {
    model: 'todos',
    payload: todoData,
  };

  const todo = await client.createNewResource(request);
  console.log('Created todo:', todo.id);
}
```

## 📚 API Reference

### Client Configuration

```javascript
const client = new ApitoClient({
  baseURL: 'https://api.apito.io/graphql',  // Your Apito GraphQL endpoint
  apiKey: 'your-api-key-here',             // X-APITO-KEY header value
  timeout: 30000,                          // Request timeout in milliseconds
  tenantId: 'your-tenant-id',              // Optional tenant ID
  httpClient: {                            // Optional axios configuration
    maxRedirects: 5,
    // ... other axios config
  },
});
```

### Core Methods

#### `getSingleResource(model, id, singlePageData?)`
Get a single resource by model and ID.

```javascript
const todo = await client.getSingleResource('todos', '123');
console.log(todo.data.title);
```

#### `searchResources(model, filter?, aggregate?)`
Search resources in a model with filtering. Only these `filter` fields are sent to GraphQL (same as the Go internal SDK): `_key`, `page`, `limit`, `where`, `search`. The `aggregate` argument is reserved for a future schema option and is not sent today.

```javascript
const results = await client.searchResources('todos', {
  where: { status: 'todo' },
  limit: 10,
  page: 1,
});
console.log(`Found ${results.count} todos`);
```

#### `createNewResource(request)`
Create a new resource.

```javascript
const newTodo = await client.createNewResource({
  model: 'todos',
  payload: {
    title: 'New Task',
    status: 'todo',
  },
  connect: { user: 'user-123' }, // Optional relations
});
```

#### `updateResource(request)`
Update an existing resource.

```javascript
const updatedTodo = await client.updateResource({
  model: 'todos',
  id: '123',
  payload: {
    status: 'completed',
    completed_at: new Date().toISOString(),
  },
  connect: { tags: ['urgent'] }, // Add relations
  disconnect: { tags: ['low-priority'] }, // Remove relations
});
```

#### `deleteResource(model, id)`
Delete a resource.

```javascript
await client.deleteResource('todos', '123');
```

#### `getRelationDocuments(id, connection)`
Get related documents.

```javascript
const relatedUsers = await client.getRelationDocuments('todo-123', {
  model: 'users',
  field: 'assigned_to',
});
```

### Project users (system GraphQL)

These calls use the admin client and system GraphQL endpoint. They mirror the Go SDK. Pass `projectId`; on Pro/SaaS engines each user may include `tenant_id`.

| Method | Description |
|--------|-------------|
| `searchUsers(projectId, limit?, offset?)` | List project end-users (`email`, `phone`, optional `tenant_id`). |
| `searchTenantsByDomain(projectId, domain)` | Exact domain lookup in project scope; returns `{ tenant }` (null if no match). |
| `createUser(projectId, params)` | Create a local-password user; `params`: `{ password, role?, email?, phone? }`. Engine rejects duplicate email/phone project-wide. |
| `loginUser(params)` | General: `{ projectId, password, email? or phone? }`. SaaS per-tenant DB: **`tenantId` required**. Google OAuth: **`googleOAuthState(projectId)`** then **`loginUser({ projectId, authMethod: 'google', code, state })`**. Native mobile: **`loginUser({ projectId, authMethod: 'google_id_token', idToken })`**. Google login may link a verified email to an existing user instead of creating a duplicate. |
| `googleOAuthState(projectId)` | Returns **`{ state }`** for the Google authorize URL. |
| `updateUser(userId, params)` | Mutate `email`, `phone`, and/or `role` only. Engine rejects duplicate email/phone project-wide. |
| `resetUserPassword(userId, password)` | Admin password reset. |
| `deleteUser(userId)` | Remove a project user. |

### Files (REST)

REST base is derived from `baseURL` by stripping `/graphql` (when GraphQL is `/system/graphql`, defaults to **`/secured`**), or set `restBaseURL` explicitly (e.g. `http://host:5050/secured`).

File **metadata** is stored in the **project database** `files` table (not the system DB). On Pro/SaaS engines, pass `tenantId` on the client or `X-Apito-Tenant-ID` so list/upload/delete target the tenant project DB. Default `restBaseURL` resolves to `/secured` when GraphQL uses `/system/graphql`; full URLs are `/secured/files/upload`, `/secured/files/list`, and `/secured/files/delete`.

| Method | Description |
|--------|-------------|
| `uploadFile(params)` | POST `/files/upload` (multipart). |
| `listFiles(fileType?, limit?, offset?)` | GET `/files/list`. |
| `deleteFiles(ids)` | POST `/files/delete`. |

Path constants: `FILES_UPLOAD_PATH`, `FILES_LIST_PATH`, `FILES_DELETE_PATH`.

On the engine system GraphQL API, `createTenant` accepts an optional `domain`; when set, the domain must be unused in the project (otherwise the mutation fails). `updateTenant` enforces the same when setting `domain` to a non-empty value. Call those mutations via `executeGraphQL` if needed.

```javascript
const projectId = 'your-project-id';

const { users, count } = await client.searchUsers(projectId, 50, 0);
console.log(
  'users:',
  count,
  users.map((u) => u.email || u.phone || u.id),
);

const login = await client.loginUser({
  projectId,
  password: 'your-password',
  email: 'user@example.com', // use phone: '+15551234567' when project is phone mode
});
if (login.token) {
  console.log('tenant-scoped token:', login.token);
}
```

Runnable samples: `examples/users`, `examples/files` (set `APITO_BASE_URL`, `APITO_API_KEY`, `APITO_PROJECT_ID`).

### Typed Operations

For type-safe operations, use the `TypedOperations` class:

```javascript
import { TypedOperations } from '@apito-io/js-admin-sdk';

const typed = new TypedOperations(client);

// Define your types
interface Todo {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
}

// Type-safe operations
const typedTodo = await typed.createNewResourceTyped<Todo>({
  model: 'todos',
  payload: {
    title: 'Type-safe todo',
    status: 'todo',
    priority: 'high',
  },
});

// TypeScript will infer the correct type
console.log(typedTodo.data.title); // string
console.log(typedTodo.data.status); // 'todo' | 'in_progress' | 'completed'
```

### Error Handling

The SDK provides comprehensive error handling:

```javascript
import { ApitoError, ValidationError, GraphQLError } from '@apito-io/js-admin-sdk';

try {
  const result = await client.getSingleResource('todos', 'invalid-id');
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation error:', error.message);
  } else if (error instanceof GraphQLError) {
    console.error('GraphQL error:', error.graphQLErrors);
  } else if (error instanceof ApitoError) {
    console.error('API error:', error.statusCode, error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Environment Variables

You can configure the client using environment variables:

```bash
# Required
APITO_BASE_URL=https://api.apito.io/graphql
APITO_API_KEY=your-production-api-key

# Optional
APITO_TENANT_ID=your-tenant-id
APITO_TIMEOUT=30000
```

```javascript
import { ApitoClient } from '@apito-io/js-admin-sdk';

const client = new ApitoClient({
  baseURL: process.env.APITO_BASE_URL,
  apiKey: process.env.APITO_API_KEY,
  tenantId: process.env.APITO_TENANT_ID,
  timeout: parseInt(process.env.APITO_TIMEOUT || '30000'),
});
```

## 🧪 Examples

### Basic CRUD Operations

```javascript
import { ApitoClient } from '@apito-io/js-admin-sdk';

const client = new ApitoClient({
  baseURL: 'https://api.apito.io/graphql',
  apiKey: 'your-api-key',
});

// Create
const user = await client.createNewResource({
  model: 'users',
  payload: {
    name: 'John Doe',
    email: 'john@example.com',
  },
});

// Read
const fetchedUser = await client.getSingleResource('users', user.id);

// Update
const updatedUser = await client.updateResource({
  model: 'users',
  id: user.id,
  payload: {
    name: 'John Updated',
  },
});

// Delete
await client.deleteResource('users', user.id);
```

### Advanced Filtering

```javascript
// Complex search with multiple filters
const results = await client.searchResources('products', {
  where: {
    AND: [
      { price: { gte: 100 } },
      { category: { in: ['electronics', 'books'] } },
      { status: 'active' },
    ],
  },
  search: 'laptop',
  limit: 20,
  page: 1,
});
```

### Batch Operations

```javascript
// Create multiple records
const todos = [
  { title: 'Task 1', status: 'todo' },
  { title: 'Task 2', status: 'todo' },
  { title: 'Task 3', status: 'todo' },
];

const createdTodos = await Promise.all(
  todos.map(todo => client.createNewResource({
    model: 'todos',
    payload: todo,
  }))
);
```

## Parity with the Go internal SDK

This client mirrors the Go `go-internal-sdk` package and the `InternalSDKOperation` interface from `github.com/apito-io/types`.

- **Tenant header:** In Go, set `context.WithValue(ctx, "tenant_id", id)` before calls. In JavaScript, set `tenantId` on `ClientConfig`, or pass `{ tenantId }` to `executeGraphQL` options where relevant.
- **`generateTenantToken(tenantId, duration?, role?)`:** Matches engine `generateTenantToken` — `tenant_id`, `duration` (`YYYY-MM-DD`; omit for default one year ahead in UTC), optional `role` (omit for engine default `admin`). Sends `X-Apito-Tenant-ID` for the mutation. Auth uses the client `apiKey`.
- **GraphQL errors:** The Go client returns `(response, err)` when the response includes `errors`. This SDK throws `GraphQLError` with `graphQLErrors` and the full payload on `response`; use `error.partialData` to read `data` when the server returns partial success.
- **`searchResources` filter:** Only `_key`, `page`, `limit`, `where`, and `search` are forwarded. Extra keys are ignored so unknown GraphQL variables cannot break the request.
- **`TypedOperations`:** `data` is deep-cloned via `JSON.parse(JSON.stringify(...))`, matching the Go SDK’s marshal/unmarshal approach for typed document `data`.

## 🏗️ Development

### GraphQL codegen (v3.4.0+)

The SDK can emit **per-model GraphQL documents** and **TanStack Query v5 hooks** from a checked-in engine introspection snapshot.

```bash
# 1. Refresh schema/apito_introspection.json from your engine (introspection query + X-Apito-Key)
# 2. Regenerate operations + types
npm run gen          # gen:operations + gen:types
# or separately:
npm run gen:operations   # → codegen/operations/*.graphql, codegen/schema.graphql
npm run gen:types        # → src/generated/types.ts, sdk.ts, hooks.ts
```

**Exports:** `getSdk`, `createApitoFetcher`, `useApitoFetcher`, generated hooks, and naming helpers (`apitoGraphQLComposedTypeName`, `DocumentBuilder`, …) from the package root.

**Optional peer:** `@tanstack/react-query` ^5 (for generated hooks only; core `ApitoClient` does not require React).

See [CONTRACT.md](CONTRACT.md) for the cross-SDK naming/operation contract shared with Flutter and Go admin SDKs.

### Building from Source

```bash
git clone https://github.com/apito-io/js-admin-sdk.git
cd js-admin-sdk
npm install
npm run build
```

### Running Tests

```bash
npm test
```

### Running Examples

```bash
cd examples/basic
npm install
npm start
```

Pro tenant-user listing (optional `APITO_TENANT_EMAIL` / `APITO_TENANT_PHONE` + `APITO_TENANT_PASSWORD` for login):

```bash
cd examples/users
npm install
APITO_BASE_URL=http://localhost:5050/system/graphql APITO_API_KEY=... APITO_PROJECT_ID=... npm start
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Apito Documentation](https://docs.apito.io)
- [npm Package](https://www.npmjs.com/package/@apito-io/js-admin-sdk)
- [GitHub Repository](https://github.com/apito-io/js-admin-sdk)
- [Issues](https://github.com/apito-io/js-admin-sdk/issues)

## 🆘 Support

- 📧 Email: support@apito.io
- 💬 Discord: [Join our community](https://discord.gg/apito)
- 📖 Documentation: [docs.apito.io](https://docs.apito.io)
- 🐛 Bug Reports: [GitHub Issues](https://github.com/apito-io/js-admin-sdk/issues)
