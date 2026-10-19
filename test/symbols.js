// Checks definition parsing and equate evaluation: node test/symbols.js [<repo> ...]. With repos, also parses every
// source file in them and prints how many definitions of each kind were found and how many equates evaluate.
const fs = require('fs'), path = require('path'), assert = require('assert');
const { parseDef, parseFile, wordAt, evaluate, format } = require('../symbols');

const def = l => { const d = parseDef(l); return d && [d.kind, d.name, d.col, d.expr]; };
assert.deepStrictEqual(def('PAL_MODE equ 0'), ['equ', 'PAL_MODE', 0, '0']);
assert.deepStrictEqual(def('MaxSprites equ 64\t\t\t;max sprites'), ['equ', 'MaxSprites', 0, '64']);
assert.deepStrictEqual(def('JoyPad\t\t\t\t=\t$0776\t\t; buttons held'), ['equ', 'JoyPad', 0, '$0776']);
assert.deepStrictEqual(def('RAMStart = $FF0000\t'), ['equ', 'RAMStart', 0, '$FF0000']);
assert.deepStrictEqual(def('passbits\t\t\trs.w\t5'), ['equ', 'passbits', 0, '5']);
assert.deepStrictEqual(def('    Foo = 1'), ['equ', 'Foo', 4, '1']);
assert.deepStrictEqual(def('!flag = $10'), ['equ', '!flag', 0, '$10']);
assert.deepStrictEqual(def('VmInc MACRO\t\t;set video auto inc. mode'), ['macro', 'VmInc', 0, undefined]);
assert.deepStrictEqual(def('macro Player(name, w1)\t; x'), ['macro', 'Player', 6, undefined]);
assert.deepStrictEqual(def('AllStarsWest:\t\t;team record'), ['label', 'AllStarsWest', 0, undefined]);
assert.deepStrictEqual(def('Begin\t\t\t;cold start'), ['label', 'Begin', 0, undefined]);
assert.strictEqual(def('\tmove.w\t#$FF00FF,(PalMode).w'), null);   // indented: an instruction
assert.strictEqual(def('.0\tclr.l\t(a0)+'), null);                 // local label
assert.strictEqual(def('; Vctrl\t=\tVdata+4'), null);              // commented out
assert.strictEqual(def('* star comment'), null);
assert.strictEqual(def('IF REV>=1'), null);
assert.strictEqual(def('\tIF X == 1'), null);
assert.strictEqual(def('lorom'), null);
assert.strictEqual(def('\tbset\t#7,(sflags7).w'), null);       // bset, not b set

const w = (l, c) => { const x = wordAt(l, c); return x && l.slice(x.start, x.end); };
assert.strictEqual(w('\tlea\tJoyPad,a0', 7), 'JoyPad');
assert.strictEqual(w('\tlea\tJoyPad,a0', 11), 'JoyPad');          // end of the word counts
assert.strictEqual(w('\tbra\t.loop', 8), null);                    // local label
assert.strictEqual(w('\tmove.w\t#1,d0\t;JoyPad here', 18), null);  // comment
assert.strictEqual(w('\tdb\t"JoyPad;",0', 8), null);               // string
assert.strictEqual(w('\tlda.w\t!flag', 10), '!flag');

const table = { a: 4, b: 0x10, big: 0xFFFF0000 };
const look = n => (n in table ? table[n] : null);
const ev = e => evaluate(e, look);
assert.strictEqual(ev('$07BC'), 0x7BC);
assert.strictEqual(ev('64'), 64);
assert.strictEqual(ev('%1010'), 10);
assert.strictEqual(ev('0x1F'), 31);
assert.strictEqual(ev('a+b*2'), 36);
assert.strictEqual(ev('(a+b)*2'), 40);
assert.strictEqual(ev('1<<a'), 16);
assert.strictEqual(ev('$FF00>>8'), 255);
assert.strictEqual(ev('$1234&$FF'), 0x34);
assert.strictEqual(ev('big+4'), 0xFFFF0004);
assert.strictEqual(ev('-a'), -4);
assert.strictEqual(ev('nope+1'), null);
assert.strictEqual(ev('a+'), null);
assert.strictEqual(ev('"text"'), null);
assert.strictEqual(ev('*'), null);
assert.strictEqual(evaluate('x', n => (n === 'x' ? evaluate('x', () => 1, 99) : null)), null);

assert.strictEqual(format(0), '$00');
assert.strictEqual(format(64), '$40 (64)');
assert.strictEqual(format(0x7BC), '$07BC (1980)');
assert.strictEqual(format(0xFFFF0000), '$FFFF0000 (4294901760)');
assert.strictEqual(format(-5), '-5');
console.log('unit checks passed');

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.name === '.git' || e.name === 'node_modules' ? []
  : e.isDirectory() ? walk(path.join(d, e.name)) : /\.(asm|mac|inc)$/i.test(e.name) ? [path.join(d, e.name)] : []);
for (const repo of process.argv.slice(2).map(r => path.resolve(r))) {
  const defs = walk(repo).flatMap(f => parseFile(fs.readFileSync(f, 'utf8')));
  const equ = defs.filter(d => d.kind === 'equ' && !d.op.startsWith('rs'));
  const byName = new Map(equ.map(d => [d.name, d]));
  const val = (d, depth = 0) => evaluate(d.expr, (n, k) => (byName.has(n) ? val(byName.get(n), k) : null), depth);
  const ok = equ.filter(d => val(d) !== null).length;
  const count = k => defs.filter(d => d.kind === k).length;
  console.log(`${path.basename(repo)}: ${count('equ')} equates (${ok}/${equ.length} evaluate), ${count('label')} labels, ${count('macro')} macros`);
}
