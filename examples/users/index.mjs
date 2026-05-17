import { ApitoClient } from '@apito-io/js-admin-sdk';

const baseURL = process.env.APITO_BASE_URL || 'http://localhost:5050/system/graphql';
const apiKey = process.env.APITO_API_KEY;
const projectId = process.env.APITO_PROJECT_ID;

if (!apiKey) {
  console.error('APITO_API_KEY is required');
  process.exit(1);
}
if (!projectId) {
  console.error('APITO_PROJECT_ID is required');
  process.exit(1);
}

const client = new ApitoClient({ baseURL, apiKey });

const { users, count } = await client.searchUsers(projectId, 50, 0);
console.log(`Users (count=${count}):`);
for (const u of users) {
  const label = u.email || u.phone || '(no email/phone)';
  console.log(`  - ${label} (${u.id}) role=${u.role} status=${u.status}`);
}

const email = (process.env.APITO_TENANT_EMAIL || '').trim();
const phone = (process.env.APITO_TENANT_PHONE || '').trim();
const password = process.env.APITO_TENANT_PASSWORD;
if ((email || phone) && password) {
  const login = await client.loginUser({
    projectId,
    password,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  });
  console.log(`Login OK, token length=${login.token.length}`);
}
