// Finds equates, labels and macros in assembly source and evaluates simple equate values. No vscode dependency, so
// test/symbols.js can run it with plain node.

// Words that start a column-0 line but are directives, not labels.
const NOT_LABELS = new Set(['if', 'ifd', 'ifnd', 'ifdef', 'ifndef', 'else', 'elseif', 'endif', 'endc', 'endm', 'endmacro', 'macro',
  'include', 'incbin', 'incsrc', 'binclude', 'org', 'even', 'cnop', 'section', 'opt', 'list', 'nolist', 'rsset', 'rsreset',
  'lorom', 'hirom', 'exlorom', 'exhirom', 'fastrom', 'arch', 'base', 'bank', 'print', 'warn', 'error', 'assert', 'struct',
  'endstruct', 'namespace', 'pushpc', 'pullpc', 'math', 'freespace', 'spc700', 'dc', 'dcb', 'ds', 'db', 'dw', 'dl', 'dd']);

const NAME = '(!?[A-Za-z_][\\w]*)';
const RE_EQU = new RegExp('^[ \\t]*' + NAME + '(?::?[ \\t]*(=(?!=))|:?[ \\t]+((?:equ|set|rs(?:\\.[bwl])?)(?=[ \\t]|$)))[ \\t]*(.*)$', 'i');
const RE_MACRO_BEFORE = new RegExp('^' + NAME + ':?[ \\t]+macro\\b', 'i');
const RE_MACRO_AFTER = new RegExp('^[ \\t]*macro[ \\t]+' + NAME, 'i');
const RE_LABEL = new RegExp('^' + NAME + '(:?)(?=[ \\t]|;|$)');

// The line without its ';' comment. Quotes are respected so a ';' inside a string stays.
function code(line) {
  let q = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = ''; } else if (c === '"' || c === "'") q = c; else if (c === ';') return line.slice(0, i);
  }
  return line;
}

// The definition on a source line as {name, col, kind, expr}, or null. kind is 'equ', 'macro' or 'label'; expr is the
// text of an equate's value (comment removed). col is the column of the name.
function parseDef(line) {
  if (!line || line[0] === ';' || line[0] === '*') return null;
  const src = code(line);
  let m = RE_EQU.exec(src);
  if (m) return { name: m[1], col: src.indexOf(m[1]), kind: 'equ', op: (m[2] || m[3]).toLowerCase(), expr: m[4].trim() };
  m = RE_MACRO_BEFORE.exec(src);
  if (m) return { name: m[1], col: 0, kind: 'macro' };
  m = RE_MACRO_AFTER.exec(src);
  if (m) return { name: m[1], col: src.indexOf(m[1], src.toLowerCase().indexOf('macro') + 5), kind: 'macro' };
  m = RE_LABEL.exec(src);
  if (m && !NOT_LABELS.has(m[1].toLowerCase()) && !m[1].startsWith('!')) return { name: m[1], col: 0, kind: 'label' };
  return null;
}

// All definitions in a file's text: [{name, line, col, kind, op, expr, text}], text being the line itself.
function parseFile(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((l, i) => {
    const d = parseDef(l);
    if (d) out.push({ ...d, line: i, text: l });
  });
  return out;
}

// The identifier at column col of a line, or null: not a local (.x, @x, ?x), not in a comment or a string.
function wordAt(line, col) {
  const src = code(line);
  if (col > src.length) return null;
  const re = /[!?.@]?[A-Za-z_][\w]*/g;
  for (let m; (m = re.exec(src));) {
    if (col < m.index) return null;
    if (col <= m.index + m[0].length) {
      if (/^[.@?]/.test(m[0])) return null;
      // inside a quoted string?
      let q = '';
      for (let i = 0; i < m.index; i++) {
        const c = src[i];
        if (q) { if (c === q) q = ''; } else if (c === '"' || c === "'") q = c;
      }
      return q ? null : { name: m[0], start: m.index, end: m.index + m[0].length };
    }
  }
  return null;
}

// Evaluates an equate expression with + - * / % << >> & | ^ ~ ( ), $hex 0xhex %bin and decimal numbers, naming other
// equates through lookup(name) -> number|null. Returns a number or null when it cannot be worked out.
function evaluate(expr, lookup, depth = 0) {
  if (depth > 8) return null;
  const toks = expr.match(/\$[0-9A-Fa-f]+|0[xX][0-9A-Fa-f]+|%[01]+|\d+|!?[A-Za-z_]\w*|<<|>>|[-+*/%&|^~()]/g);
  if (!toks || toks.join('').length < expr.replace(/\s+/g, '').length) return null;
  let p = 0;
  const peek = () => toks[p];
  const num = t => t[0] === '$' ? parseInt(t.slice(1), 16) : /^0x/i.test(t) ? parseInt(t.slice(2), 16)
    : t[0] === '%' ? parseInt(t.slice(1), 2) : parseInt(t, 10);
  const prim = () => {
    const t = toks[p++];
    if (t === undefined) throw 0;
    if (t === '(') { const v = or(); if (toks[p++] !== ')') throw 0; return v; }
    if (t === '-') return -prim();
    if (t === '+') return prim();
    if (t === '~') return ~prim();
    if (/^[\d$%]/.test(t)) { const v = num(t); if (Number.isNaN(v)) throw 0; return v; }
    if (/^!?[A-Za-z_]/.test(t)) { const v = lookup(t, depth + 1); if (v === null || v === undefined) throw 0; return v; }
    throw 0;
  };
  const bin = (next, ops) => () => {
    let v = next();
    while (ops.includes(peek())) {
      const o = toks[p++], r = next();
      v = o === '*' ? v * r : o === '/' ? Math.trunc(v / r) : o === '%' ? v % r : o === '+' ? v + r : o === '-' ? v - r
        : o === '<<' ? v * 2 ** r : o === '>>' ? Math.floor(v / 2 ** r) : o === '&' ? Number(BigInt(v) & BigInt(r))
        : o === '|' ? Number(BigInt(v) | BigInt(r)) : Number(BigInt(v) ^ BigInt(r));
    }
    return v;
  };
  const mul = bin(prim, ['*', '/', '%']), add = bin(mul, ['+', '-']), shift = bin(add, ['<<', '>>']);
  const and = bin(shift, ['&']), xor = bin(and, ['^']), or = bin(xor, ['|']);
  try {
    const v = or();
    return p === toks.length && Number.isFinite(v) ? v : null;
  } catch (e) { return null; }
}

// "$07BC (1980)" for a value, "-5" for a negative one.
function format(v) {
  if (v < 0) return String(v);
  const hex = v.toString(16).toUpperCase();
  return '$' + hex.padStart(hex.length + (hex.length % 2), '0') + (v > 9 ? ` (${v})` : '');
}

module.exports = { parseDef, parseFile, wordAt, evaluate, format };
