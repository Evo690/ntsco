import { readFile, access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build, root } from './build.mjs';

await build();
const contract = JSON.parse(await readFile(path.join(root, 'tests/feature-contract.json'), 'utf8'));
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const script = await readFile(path.join(root, 'main.js'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML IDs must be unique');
for (const id of contract.ids) assert(ids.includes(id), `Preserved DOM contract: #${id}`);
for (const name of contract.functions) assert(new RegExp(`(?:async )?function ${name}\\(`).test(script), `Preserved handler: ${name}`);
const toolContracts = JSON.parse(await readFile(path.join(root, 'tests/tool-contract.json'), 'utf8'));
for (const [file, requiredIds] of Object.entries(toolContracts)) {
  const source = await readFile(path.join(root, file), 'utf8');
  const actual = [...source.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(actual).size, actual.length, `Unique tool IDs: ${file}`);
  for (const id of requiredIds) assert(actual.includes(id), `Tool contract: ${file} #${id}`);
}
for (const file of ['index.html', ...contract.standalone]) {
  const content = await readFile(path.join(root, file), 'utf8');
  for (const [, url] of content.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (/^(https?:|data:|javascript:|mailto:|#)/.test(url)) continue;
    const assetPath = path.resolve(root, path.dirname(file), url.split('?')[0]);
    await access(assetPath);
    if (/\.(css|js)(?:\?|$)/.test(url)) {
      const revision = createHash('sha256').update(await readFile(assetPath)).digest('hex').slice(0, 12);
      assert.equal(url.split('?')[1], `v=${revision}`, `Current asset revision: ${file} → ${url}`);
    }
  }
}
async function checkScripts(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await checkScripts(file);
    else if (/\.(m?js)$/.test(file)) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      assert.equal(result.status, 0, `${file}: ${result.stderr}`);
    }
  }
}
for (const dir of ['src', 'functions', 'scripts']) await checkScripts(path.join(root, dir));
for (const file of ['core.js', 'main.js', 'scraper.js', 'pseudo_leaderboard.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
console.log(`✓ ${contract.ids.length} existing DOM IDs, ${contract.functions.length} handlers, ${contract.standalone.length} standalone pages, local assets and JavaScript syntax verified.`);
