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

Windows (cmd or PowerShell), from the repo root: `vscode\install.cmd` (PowerShell: `.\vscode\install.cmd`). Then restart VS Code.

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
