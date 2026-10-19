// Ctrl+click (and F12) on the path of an include/incbin/incsrc line opens that file. Ctrl+click on an equate, label or
// macro name goes to where it is defined, and hovering one shows its definition and, for an equate, its value.
const fs = require('fs'), path = require('path');
const vscode = require('vscode');
const { parseLine, resolve } = require('./includes');
const { parseFile, wordAt, evaluate, format } = require('./symbols');

const LANGS = ['nhl-m68k', 'nhl-65816', 'nhl-asm'];
const GLOB = '**/*.{asm,inc,mac,mac68k,mac65816}';
const EXCLUDE = '**/{node_modules,.git,.cache,Extracted}/**';
const MAX_BYTES = 4 * 1024 * 1024;

function find(doc, line) {
  const hit = parseLine(doc.lineAt(line).text);
  if (!hit) return null;
  const roots = (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath);
  const target = resolve(hit.file, doc.uri.fsPath, roots);
  return target && { range: new vscode.Range(line, hit.start, line, hit.end), uri: vscode.Uri.file(target) };
}

// Every definition in the workspace, by name. Files are read once, then kept current from the editor buffers and a
// file watcher.
class Index {
  constructor() {
    this.files = new Map();   // fsPath -> [def]
    this.names = new Map();   // name -> [def]
    this.ready = null;
    this.roots = new Map();   // directory -> repository root
  }

  build() {
    if (!this.ready) {
      this.ready = vscode.workspace.findFiles(GLOB, EXCLUDE).then(async uris => {
        for (let i = 0; i < uris.length; i += 64) await Promise.all(uris.slice(i, i + 64).map(u => this.read(u.fsPath)));
      });
    }
    return this.ready;
  }

  set(file, defs) {
    for (const d of this.files.get(file) || []) {
      const list = this.names.get(d.name);
      if (list) { const i = list.indexOf(d); if (i >= 0) list.splice(i, 1); if (!list.length) this.names.delete(d.name); }
    }
    if (!defs) { this.files.delete(file); return; }
    defs.forEach(d => { d.file = file; if (!this.names.has(d.name)) this.names.set(d.name, []); this.names.get(d.name).push(d); });
    this.files.set(file, defs);
  }

  async read(file) {
    try {
      if ((await fs.promises.stat(file)).size > MAX_BYTES) return;
      this.set(file, parseFile(await fs.promises.readFile(file, 'utf8')));
    } catch (e) { this.set(file, null); }
  }

  fromText(file, text) { this.set(file, parseFile(text)); }

  // The directory above file that holds .git (the repo the file belongs to), else the workspace folder, else its dir.
  root(file) {
    let dir = path.dirname(file);
    if (this.roots.has(dir)) return this.roots.get(dir);
    let found = null;
    for (let d = dir; !found; d = path.dirname(d)) {
      if (fs.existsSync(path.join(d, '.git'))) found = d;
      if (path.dirname(d) === d) break;
    }
    if (!found) {
      const w = (vscode.workspace.workspaceFolders || []).find(f => dir === f.uri.fsPath || dir.startsWith(f.uri.fsPath + path.sep));
      found = w ? w.uri.fsPath : dir;
    }
    this.roots.set(dir, found);
    return found;
  }

  // Definitions of name that the document at docPath sees: those in its own repo (all of them when there are none),
  // equates and macros before labels, its own file first.
  lookup(name, docPath) {
    const all = this.names.get(name) || [];
    const root = this.root(docPath);
    const same = all.filter(d => this.root(d.file) === root);
    const list = same.length ? same : all;
    const rank = d => (d.kind === 'label' ? 2 : 0) + (d.file === docPath ? 0 : 1);
    return list.slice().sort((a, b) => rank(a) - rank(b) || a.file.localeCompare(b.file) || a.line - b.line);
  }

  // The number an equate stands for, or null. Names inside the expression resolve the same way (first definition wins).
  value(def, docPath, depth = 0) {
    if (def.kind !== 'equ' || def.op.startsWith('rs')) return null;
    return evaluate(def.expr, (n, d) => {
      const target = this.lookup(n, docPath).find(x => x.kind === 'equ' && !x.op.startsWith('rs'));
      return target ? this.value(target, docPath, d) : null;
    }, depth);
  }
}

function symbolAt(doc, pos) {
  const line = doc.lineAt(pos.line).text;
  const inc = parseLine(line);
  if (inc && pos.character >= inc.start && pos.character <= inc.end) return null;
  const w = wordAt(line, pos.character);
  if (!w) return null;
  return { ...w, range: new vscode.Range(pos.line, w.start, pos.line, w.end) };
}

function activate(context) {
  const sel = LANGS.map(language => ({ language, scheme: 'file' }));
  const index = new Index();
  const rel = file => vscode.workspace.asRelativePath(file, false);
  index.build();

  const timers = new Map();
  const watcher = vscode.workspace.createFileSystemWatcher(GLOB);
  const reread = u => { if (!vscode.workspace.textDocuments.some(d => d.uri.fsPath === u.fsPath && d.isDirty)) index.read(u.fsPath); };
  context.subscriptions.push(
    watcher,
    watcher.onDidCreate(reread),
    watcher.onDidChange(reread),
    watcher.onDidDelete(u => index.set(u.fsPath, null)),
    vscode.workspace.onDidChangeTextDocument(e => {
      const d = e.document;
      if (d.uri.scheme !== 'file' || !LANGS.includes(d.languageId) || !index.ready) return;
      clearTimeout(timers.get(d.uri.fsPath));
      timers.set(d.uri.fsPath, setTimeout(() => index.fromText(d.uri.fsPath, d.getText()), 300));
    }),
    vscode.languages.registerDocumentLinkProvider(sel, {
      provideDocumentLinks(doc) {
        const links = [];
        for (let i = 0; i < doc.lineCount; i++) {
          const f = find(doc, i);
          if (f) links.push(new vscode.DocumentLink(f.range, f.uri));
        }
        return links;
      }
    }),
    // No DocumentLink for symbols: a definition provider underlines nothing until Ctrl is held.
    vscode.languages.registerDefinitionProvider(sel, {
      async provideDefinition(doc, pos) {
        const f = find(doc, pos.line);
        if (f && f.range.contains(pos)) return new vscode.Location(f.uri, new vscode.Position(0, 0));
        const s = symbolAt(doc, pos);
        if (!s) return null;
        await index.build();
        const defs = index.lookup(s.name, doc.uri.fsPath)
          .filter(d => !(d.file === doc.uri.fsPath && d.line === pos.line && d.col === s.start));
        return defs.map(d => new vscode.Location(vscode.Uri.file(d.file),
          new vscode.Range(d.line, d.col, d.line, d.col + d.name.length)));
      }
    }),
    vscode.languages.registerHoverProvider(sel, {
      async provideHover(doc, pos) {
        const s = symbolAt(doc, pos);
        if (!s) return null;
        await index.build();
        const defs = index.lookup(s.name, doc.uri.fsPath);
        if (!defs.length) return null;
        const md = new vscode.MarkdownString();
        defs.slice(0, 3).forEach((d, i) => {
          if (i) md.appendMarkdown('\n\n---\n\n');
          const v = index.value(d, doc.uri.fsPath);
          if (v !== null) md.appendMarkdown(`**${d.name}** = \`${format(v)}\`\n\n`);
          md.appendCodeblock(d.text.trim(), doc.languageId);
          md.appendMarkdown(`${d.kind === 'equ' ? 'equate' : d.kind} in ${rel(d.file)}:${d.line + 1}`);
        });
        if (defs.length > 3) md.appendMarkdown(`\n\n(${defs.length - 3} more)`);
        return new vscode.Hover(md, s.range);
      }
    }));
}

module.exports = { activate, deactivate() {} };
