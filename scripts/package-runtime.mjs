import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const output = resolve(root, '.deploy-runtime');
for (const path of ['client/dist/index.html', 'server/node_modules/express/package.json', 'server/node_modules/ws/package.json']) {
  if (!existsSync(resolve(root, path))) throw new Error(`Missing runtime input: ${path}`);
}
rmSync(output, { recursive: true, force: true });
mkdirSync(resolve(output, 'server'), { recursive: true });
mkdirSync(resolve(output, 'client'), { recursive: true });
for (const name of readdirSync(resolve(root, 'server'))) {
  if (name.endsWith('.js') && !name.endsWith('.test.js')) {
    cpSync(resolve(root, 'server', name), resolve(output, 'server', name));
  }
}
for (const name of ['package.json', 'node_modules']) {
  cpSync(resolve(root, 'server', name), resolve(output, 'server', name), { recursive: true, verbatimSymlinks: true });
}
cpSync(resolve(root, 'client/dist'), resolve(output, 'client/dist'), { recursive: true, verbatimSymlinks: true });
writeFileSync(resolve(output, 'DEPLOYMENT.json'), JSON.stringify({
  revision: process.env.GITHUB_SHA || null,
  application: 'snake-game',
  entry: 'server/index.js',
  node: process.version,
}, null, 2) + '\n');
console.log('Packaged server production dependencies and compiled client in .deploy-runtime');
