// Post-build: make dist/ a self-contained cPanel app folder.
// Upload the folder's contents as-is; startup file = passenger-entry.js (or main.js).
import { copyFileSync, cpSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = 'dist';

copyFileSync('package.json', join(out, 'package.json'));

// Prisma schema + migrations merge into dist/prisma (already holds compiled module)
cpSync('prisma', join(out, 'prisma'), { recursive: true });

writeFileSync(
  join(out, 'passenger-entry.js'),
  "// cPanel Passenger startup file — starts the NestJS application\nrequire('./main.js');\n",
);

console.log(`Deploy files written to ${out} (package.json, prisma/, passenger-entry.js)`);
