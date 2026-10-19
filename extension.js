// Ctrl+click (and F12) on the path of an include/incbin/incsrc line opens that file.
const vscode = require('vscode');
const { parseLine, resolve } = require('./includes');

const LANGS = ['nhl-m68k', 'nhl-65816', 'nhl-asm'];

function find(doc, line) {
  const hit = parseLine(doc.lineAt(line).text);
  if (!hit) return null;
  const roots = (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath);
  const target = resolve(hit.file, doc.uri.fsPath, roots);
  return target && { range: new vscode.Range(line, hit.start, line, hit.end), uri: vscode.Uri.file(target) };
}

function activate(context) {
  const sel = LANGS.map(language => ({ language, scheme: 'file' }));
  context.subscriptions.push(
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
    vscode.languages.registerDefinitionProvider(sel, {
      provideDefinition(doc, pos) {
        const f = find(doc, pos.line);
        return f && f.range.contains(pos) ? new vscode.Location(f.uri, new vscode.Position(0, 0)) : null;
      }
    }));
}

module.exports = { activate, deactivate() {} };
