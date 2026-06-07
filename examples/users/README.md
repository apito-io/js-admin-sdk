# Project users example

Lists project end-users and optionally logs in with email/phone + password, Google OAuth code, or native **`google_id_token`**.

```bash
export APITO_API_KEY=...
export APITO_PROJECT_ID=...
# optional
export APITO_BASE_URL=http://localhost:5050/system/graphql
export APITO_TENANT_EMAIL=user@example.com
export APITO_TENANT_PASSWORD=secret

node examples/users/index.mjs
```

For Google OAuth redirect flow, call `googleOAuthState(projectId)` before opening Google. For native mobile, use `loginUser({ projectId, authMethod: 'google_id_token', idToken })`.
