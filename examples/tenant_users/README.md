# Tenant catalog users (Pro)

Mirrors the Go SDK [`examples/tenant_users`](https://github.com/apito-io/go-admin-sdk/tree/master/examples/tenant_users): list tenant users and optionally verify password login.

## Environment

| Variable             | Required | Description                                                         |
| -------------------- | -------- | ------------------------------------------------------------------- |
| `APITO_API_KEY`      | yes      | Admin API key                                                       |
| `APITO_PROJECT_ID`   | yes      | Project id                                                          |
| `APITO_BASE_URL`     | no       | Default `http://localhost:5050/system/graphql`                      |
| `APITO_TENANT_EMAIL` | no       | With `APITO_TENANT_PASSWORD`, runs login for email-sign-in projects |
| `APITO_TENANT_PHONE` | no       | With `APITO_TENANT_PASSWORD`, runs login for phone-sign-in projects |

## Run

```bash
npm install
APITO_API_KEY=... APITO_PROJECT_ID=... npm start
```

With login:

```bash
APITO_TENANT_EMAIL=user@example.com APITO_TENANT_PASSWORD=... npm start
```
