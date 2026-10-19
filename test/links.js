// Checks include/incbin/incsrc resolution over whole repos: node links.js <repo> [<repo> ...]
// Prints every directive whose file is not found, then a count per repo.
const fs = require('fs'), path = require('path');
const { parseLine, resolve } = require('../includes');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.name === '.git' || e.name === 'node_modules' ? []
  : e.isDirectory() ? walk(path.join(d, e.name)) : /\.(asm|mac|inc)$/i.test(e.name) ? [path.join(d, e.name)] : []);
for (const repo of process.argv.slice(2).map(r => path.resolve(r))) {
  let found = 0, missing = 0;
  for (const f of walk(repo))
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l, i) => {
      const hit = parseLine(l);
      if (!hit) return;
      if (l.slice(hit.start, hit.end) !== hit.file) throw new Error(`bad columns ${f}:${i + 1}`);
      if (resolve(hit.file, f, [repo])) found++;
      else { missing++; console.log(`missing ${path.relative(repo, f)}:${i + 1}: ${hit.file}`); }
    });
  console.log(`${path.basename(repo)}: ${found} resolved, ${missing} missing`);
}
