# NHL assembly modes for VS Code

Syntax highlighting and go-to-include for the NHL Genesis and SNES disassembly repos
([NHL92Genesis](https://github.com/abdulahmad/NHL92Genesis), [NHLPA93Genesis](https://github.com/abdulahmad/NHLPA93Genesis),
[NHL94Genesis](https://github.com/abdulahmad/NHL94Genesis), [NHL95Genesis](https://github.com/abdulahmad/NHL95Genesis),
[NHL96Genesis](https://github.com/abdulahmad/NHL96Genesis), [NHLPA93SNES](https://github.com/abdulahmad/NHLPA93SNES),
[NHL94SNES](https://github.com/abdulahmad/NHL94SNES)).

Two language modes for the disassembly repos, which all use `.asm`:

| Mode id | Repos | Assembler |
| --- | --- | --- |
| `nhl-m68k` | NHL92/NHLPA93/NHL94/95/96 Genesis | SNASM68K |
| `nhl-65816` | NHLPA93SNES, NHL94SNES | asar |

Numbers (`$FF00FF`, `%1010`, `12`) are scoped `constant.numeric.*` and the modes turn
`editor.colorDecorators` off, so a hex value is never drawn as a colour swatch. Tabs, 4 columns and a
110-column ruler match `tools/check_comments.py`.

## Go to an included file

Ctrl+click (Cmd+click on macOS) the path of an `include`, `incbin` or `incsrc` line, or put the cursor on it and press F12,
to open that file. The path is resolved relative to the including file first, as the assemblers do; if no file is there, the
folders above it are tried, then the path without its leading `../` (so the SNES banks' `../../../Extracted/...` finds
`Extracted/` at the repo root). `\` separators and a different case (`Main93.Asm`) are accepted. Files that do not exist yet,
such as `Extracted/` before the first build, get no link.

The path is coloured as a string in every mode, quoted (`"../x.pal"`, scoped `string.quoted.*`) or bare (`..\x.pal`,
scoped `string.unquoted.path`), so Genesis and SNES include lines look the same.

## Install

From the Marketplace: search Extensions for **NHL disassembly assembly**, or run
`code --install-extension abdulahmad.nhl-asm`. VSCodium and other Open VSX editors get it from Open VSX under the same id.

Each disassembly repo lists `abdulahmad.nhl-asm` in `.vscode/extensions.json`, so VS Code offers to install it when you open
the repo. After installing, close all tabs and reload the window. If another extension (Amiga Assembly) still claims `.asm`,
the extension is not installed: check Extensions for "NHL 68000".

From source: `npm run package` here builds `nhl-asm-<version>.vsix`; install it with `code --install-extension nhl-asm-<version>.vsix`
(or Extensions > ... > Install from VSIX). Every push also builds the `.vsix` in GitHub Actions (download it from the run's
artifacts), and a `v*` tag attaches it to a GitHub release.

## Release

1. Bump `version` in `package.json` and add a `CHANGELOG.md` entry.
2. `npx @vscode/vsce publish` (Marketplace) and `npx ovsx publish -p <token>` (Open VSX).
3. `git tag v<version> && git push --tags` to attach the `.vsix` to a GitHub release.

## Use in a repo

Copy `workspace-settings-genesis.json` or `workspace-settings-snes.json` (in this repo) to the repo's `.vscode/settings.json` (Genesis repos use the m68k
block, SNES repos the 65816 block); each repo already ships the right file. Another colour extension
(Color Highlight, etc.) can still paint `#ff0000`-looking text; the settings turn those off for these modes.

## Test

`cd test && npm i vscode-textmate vscode-oniguruma && node tokenize.js` prints the scope of every token for
sample lines. `node test/links.js <repo> ...` resolves every include in the given repos and lists the ones it cannot find.

## Colours

Macro names (`hex2`, `String`, `PIX`, `%Player(...)`, and the name after `macro`) get the scope
`entity.name.function.macro`; the workspace settings colour it orange (`#F0883E`). Change it in
`.vscode/settings.json` under `editor.tokenColorCustomizations`. Bare hex arguments of a macro call (`hex2 351d,daa0`) are
numbers like any other, so a data row is one colour.

## Setting the mode for a whole repo or folder

`files.associations` in `.vscode/settings.json` applies to every matching file in the repo, so no per-file
"Change Language Mode" is needed. For one folder only, put another `.vscode/settings.json` in a
parent folder opened as its own workspace, or use a more specific glob such as `"src/**/*.asm": "nhl-m68k"`.

## Mode selection without settings

The extension also claims files by folder name: any `.asm`/`.mac`/`.inc` under a folder whose name contains `genesis` gets `nhl-m68k`, and under a folder containing `snes` gets `nhl-65816` (case-insensitive). So the mode is chosen even when the repo is not the workspace root (for example a parent folder holding all repos). `.vscode/settings.json` still wins when the repo is the root.

## Combined mode

`nhl-asm` ("NHL assembly (68000 + 65816)") is one grammar for both families: labels with or without a colon, `equ`/`rs.w`/`=` equates,
the union of the 68000 and 65816 mnemonics and directives, `%Macro(...)` and bare macro calls, and the same colours as the
specific modes. Use it for a folder that mixes Genesis and SNES sources: `"files.associations": { "*.asm": "nhl-asm" }`.
The specific modes stay more precise (for example `a`, `x`, `y` are registers only in `nhl-65816`). `tools/gen_combined.py` rebuilds
`syntaxes/nhl-asm.tmLanguage.json` from the other two grammars; run it after changing their mnemonic or directive lists.
