import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
for (const name of ['index', 'react', 'ui']) {
  const mts = path.join(dist, `${name}.d.mts`);
  const dts = path.join(dist, `${name}.d.ts`);
  if (fs.existsSync(mts)) {
    fs.copyFileSync(mts, dts);
  }
}
