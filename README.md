# NHL assembly modes for VS Code

Two language modes for the disassembly repos, which all use `.asm`:

| Mode id | Repos | Assembler |
| --- | --- | --- |
| `nhl-m68k` | NHL92/NHLPA93/NHL94/95/96 Genesis | SNASM68K |
| `nhl-65816` | NHLPA93SNES, NHL94SNES | asar |

Numbers (`$FF00FF`, `%1010`, `12`) are scoped `constant.numeric.*` and the modes turn
`editor.colorDecorators` off, so a hex value is never drawn as a colour swatch. Tabs, 4 columns and a
110-column ruler match `tools/check_comments.py`.

## Install

Windows (cmd or PowerShell), from the repo root: `vscode\install.cmd` (PowerShell: `.\vscode\install.cmd`); it runs `code --install-extension vscode/nhl-asm.vsix`. Then close all tabs and reload the window. Rebuild the `.vsix` after changing the grammar: `cd vscode/nhl-asm && npx @vscode/vsce package --allow-missing-repository --skip-license -o ../nhl-asm.vsix`. If another extension (Amiga Assembly) still claims `.asm`, the extension is not installed: check Extensions for "NHL 68000".

macOS/Linux:

```
ln -s "$PWD" ~/.vscode/extensions/nhl-asm        # or copy the folder; restart VS Code
```

(`code --install-extension` needs a packaged `.vsix`: `npx @vscode/vsce package` in this folder.)

## Use in a repo

Copy `workspace-settings-genesis.json` or `workspace-settings-snes.json` to the repo's `.vscode/settings.json` (Genesis repos use the m68k
block, SNES repos the 65816 block); each repo already ships the right file. Another colour extension
(Color Highlight, etc.) can still paint `#ff0000`-looking text; the settings turn those off for these modes.

## Test

`cd test && npm i vscode-textmate vscode-oniguruma && node tokenize.js` prints the scope of every token for
sample lines.

## Colours

Macro names (`hex2`, `String`, `PIX`, `%Player(...)`, and the name after `macro`) get the scope
`entity.name.function.macro`; the workspace settings colour it orange (`#F0883E`). Change it in
`.vscode/settings.json` under `editor.tokenColorCustomizations`. Bare hex arguments of a macro call (`hex2 351d,daa0`) are
numbers like any other, so a data row is one colour.

## Setting the mode for a whole repo or folder

`files.associations` in `.vscode/settings.json` applies to every matching file in the repo, so no per-file
"Change Language Mode" is needed. For one folder only, put another `.vscode/settings.json` in a
parent folder opened as its own workspace, or use a more specific glob such as `"src/**/*.asm": "nhl-m68k"`.
