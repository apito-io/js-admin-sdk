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

- **Tenant header:** In Go, set `context.WithValue(ctx, "tenant_id", id)` before calls. In JavaScript, set `tenantId` on `ClientConfig`, or rely on `generateTenantToken`, which sends `X-Apito-Tenant-ID` for that mutation.
- **GraphQL errors:** The Go client returns `(response, err)` when the response includes `errors`. This SDK throws `GraphQLError` with `graphQLErrors` and the full payload on `response`; use `error.partialData` to read `data` when the server returns partial success.
- **`searchResources` filter:** Only `_key`, `page`, `limit`, `where`, and `search` are forwarded. Extra keys are ignored so unknown GraphQL variables cannot break the request.
- **`TypedOperations`:** `data` is deep-cloned via `JSON.parse(JSON.stringify(...))`, matching the Go SDK’s marshal/unmarshal approach for typed document `data`.

## 🏗️ Development

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
