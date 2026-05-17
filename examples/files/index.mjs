import { readFileSync } from 'node:fs';
import { ApitoClient } from '@apito-io/js-admin-sdk';

const baseURL = process.env.APITO_BASE_URL || 'http://localhost:5050/system/graphql';
const apiKey = process.env.APITO_API_KEY;

if (!apiKey) {
  console.error('APITO_API_KEY is required');
  process.exit(1);
}

const client = new ApitoClient({ baseURL, apiKey });

const { files, total } = await client.listFiles(undefined, 20, 0);
console.log(`Files (total=${total}):`);
for (const f of files) {
  console.log(`  - ${f.file_name} (${f.id}) ${f.url}`);
}

const path = process.env.APITO_UPLOAD_FILE;
if (path) {
  const content = readFileSync(path);
  const uploaded = await client.uploadFile({
    fileName: path.split('/').pop() || 'upload',
    content,
  });
  console.log(`Uploaded: ${uploaded.id} -> ${uploaded.url}`);
}
