// Finds include/incbin/incsrc paths in a source line and resolves them to files on disk. No vscode dependency, so
// test/links.js can run it with plain node.
const fs = require('fs'), path = require('path');

// SNASM68K: include/incbin, path bare or quoted, '\' separators. asar: incsrc/incbin "path" (incbin may add
// :start-end or -> label after the quote). An optional label may precede the directive.
const RE = /^\s*(?:[A-Za-z_.@?][\w.@?]*:?\s+)?(include|incbin|incsrc|binclude)\s+(?:"([^"]+)"|'([^']+)'|([^\s;,"']+))/i;

// Returns {start, end, file} (columns of the path text, without the quotes) or null.
function parseLine(line) {
  const m = RE.exec(line);
  if (!m) return null;
  const file = m[2] || m[3] || m[4];
  const start = m.index + m[0].length - file.length - (m[4] ? 0 : 1);
  return { start, end: start + file.length, file };
}

const isFile = p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };

// p itself if it is a file, else the file whose path matches p ignoring case (the Genesis sources write Main93.Asm for
// main93.asm, which SNASM68K finds on Windows), else null.
function findFile(p) {
  if (isFile(p)) return p;
  const parts = path.normalize(p).split(path.sep);
  let cur = parts[0] + path.sep;
  for (const part of parts.slice(1)) {
    if (!part) continue;
    let names;
    try { names = fs.readdirSync(cur); } catch (e) { return null; }
    const name = names.includes(part) ? part : names.find(n => n.toLowerCase() === part.toLowerCase());
    if (!name) return null;
    cur = path.join(cur, name);
  }
  return isFile(cur) ? cur : null;
}

// The directories from dir up to stop (inclusive), or up to the filesystem root when stop is not above dir.
function ancestors(dir, stop) {
  const out = [];
  for (let d = dir; ; d = path.dirname(d)) {
    out.push(d);
    if ((stop && d === stop) || path.dirname(d) === d) break;
  }
  return out;
}

// Resolves file as the assemblers would (relative to the including file), then relative to each folder above it,
// then with the leading ../ dropped and searched upward (the SNES banks write ../../../Extracted for Extracted/ at the
// repo root). roots are the workspace folders; the upward search stops at the one holding docPath.
function resolve(file, docPath, roots = []) {
  const rel = file.replace(/\\/g, '/');
  if (path.isAbsolute(rel)) return findFile(path.normalize(rel));
  const dir = path.dirname(docPath);
  const root = roots.find(r => dir === r || dir.startsWith(r + path.sep));
  const ups = ancestors(dir, root);
  const bare = rel.replace(/^(?:\.\.?\/)+/, '');
  const tries = [...ups.map(d => path.join(d, rel)), ...roots.map(r => path.join(r, rel)),
                 ...ups.map(d => path.join(d, bare)), ...roots.map(r => path.join(r, bare))];
  return tries.find(isFile) || tries.reduce((hit, p) => hit || findFile(p), null);
}

module.exports = { parseLine, resolve };
