# Tenant catalog users (Pro)

Mirrors the Go SDK [`examples/tenant_users`](https://github.com/apito-io/go-admin-sdk/tree/master/examples/tenant_users): list tenant users and optionally verify password login.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `APITO_API_KEY` | yes | Admin API key |
| `APITO_PROJECT_ID` | yes | Project id |
| `APITO_BASE_URL` | no | Default `http://localhost:5050/system/graphql` |
| `APITO_TENANT_USERNAME` | no | With `APITO_TENANT_PASSWORD`, runs `loginTenantUser` after search |

## Run

```bash
npm install
APITO_API_KEY=... APITO_PROJECT_ID=... npm start
```

With login:

```bash
APITO_TENANT_USERNAME=admin APITO_TENANT_PASSWORD=... npm start
```
