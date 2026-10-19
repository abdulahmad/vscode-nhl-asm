# Changelog

## 1.4.0

- Hover an equate, label or macro to see its definition and, for an equate, its value.
- Ctrl+click / F12 on one goes to its definition (no underline until Ctrl is held).

## 1.3.1

- First release from its own repository (moved from `nhl-disasm-report/vscode/nhl-asm`, history kept).
- Publisher `Abdul-HaseebAhmad`, MIT licence, icon, Marketplace metadata.
- Bare `include`/`incbin`/`incsrc` paths are coloured as strings, like quoted ones.

## 1.3.0

- Ctrl+click (or F12) on an `include`/`incbin`/`incsrc` path opens the file.

## 1.2.0

- Combined `nhl-asm` mode for folders that mix 68000 and 65816 sources.

## 1.1.0

- Mode selected by folder name (`genesis` / `snes`), so it works when the repo is not the workspace root.

## 1.0.0

- `nhl-m68k` (SNASM68K) and `nhl-65816` (asar) modes. Numbers are never drawn as colour swatches; macros are coloured orange.
