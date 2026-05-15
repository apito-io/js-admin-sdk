import { ApitoClient } from '@apito-io/js-admin-sdk';

const baseURL = process.env.APITO_BASE_URL ?? 'http://localhost:5050/system/graphql';
const apiKey = process.env.APITO_API_KEY;
const projectId = process.env.APITO_PROJECT_ID;

if (!apiKey || !projectId) {
  console.error('Set APITO_API_KEY and APITO_PROJECT_ID');
  process.exit(1);
}

const client = new ApitoClient({
  baseURL,
  apiKey,
  timeout: 30000,
});

async function main() {
  const { users, count } = await client.searchTenantUsers(projectId, 50, 0);
  console.log(`Tenant users (count=${count}):`);
  for (const u of users) {
    const label = (u.email || u.phone || '(no email/phone)').trim();
    console.log(`  - ${label} (${u.id}) role=${u.role} status=${u.status}`);
  }

  const email = (process.env.APITO_TENANT_EMAIL ?? '').trim();
  const phone = (process.env.APITO_TENANT_PHONE ?? '').trim();
  const password = process.env.APITO_TENANT_PASSWORD;
  if ((email || phone) && password) {
    const login = await client.loginTenantUser({ projectId, password, ...(email ? { email } : {}), ...(phone ? { phone } : {}) });
    console.log('Login OK, token length:', login.token?.length ?? 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
