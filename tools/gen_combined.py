#!/usr/bin/env python3
"""Builds syntaxes/nhl-asm.tmLanguage.json (one grammar for Genesis 68000 and SNES 65816 sources)
by taking the union of the mnemonic and directive lists of nhl-m68k and nhl-65816."""
import json, os, re
D = os.path.join(os.path.dirname(__file__), '..', 'syntaxes')
m = json.load(open(os.path.join(D, 'nhl-m68k.tmLanguage.json')))
s = json.load(open(os.path.join(D, 'nhl-65816.tmLanguage.json')))

def alt(rx, start):
    i = rx.index('(?:' + start)
    depth, j = 0, i
    while True:
        c = rx[j]
        if c == '(' and rx[j-1] != '\\': depth += 1
        elif c == ')' and rx[j-1] != '\\':
            depth -= 1
            if depth == 0: return rx[i+3:j]
        j += 1

m_mn = alt(m['repository']['mnemonic']['patterns'][0]['match'], 'abcd')
s_mn = alt(s['repository']['mnemonic']['patterns'][0]['match'], 'adc')
kw = lambda g: next(p for p in g['repository']['directive']['patterns'] if p.get('name', '').startswith('keyword.'))
m_dr = alt(kw(m)['match'], 'include')
s_dr = alt(kw(s)['match'], 'db')
MN = m_mn + '|' + s_mn
DR = m_dr + '|' + s_dr
SUF = '(?:\\.[bwls])?'
N = 'nhl-asm'
def sc(x): return x + '.' + N

operand = [
 {"name": sc("storage.modifier.size"), "match": "(?<=[)\\]])\\.[bwl](?![\\w])"},
 {"name": sc("string.quoted.double"), "begin": "\"", "end": "\""},
 {"name": sc("string.quoted.single"), "begin": "'", "end": "'"},
 {"name": sc("variable.parameter.macro"), "match": "<[A-Za-z_][A-Za-z0-9_]*>"},
 {"name": sc("variable.language.register"), "match": "(?i)(?<![\\w.$])(?:[da][0-7]|sp|sr|ccr|pc|usp|[axy])(?![\\w])"},
 {"name": sc("constant.numeric.hex"), "match": "\\$[0-9A-Fa-f]+"},
 {"name": sc("constant.numeric.binary"), "match": "%[01]+(?![\\w])"},
 {"name": sc("constant.numeric.decimal"), "match": "(?<![\\w.$])\\d+(?![\\w])"},
 {"name": sc("support.constant.local-label"), "match": "(?<![\\w)\\]])[.?][A-Za-z0-9_]+"},
 {"name": sc("variable.other.define"), "match": "![A-Za-z_][A-Za-z0-9_]*"},
 {"name": sc("keyword.operator"), "match": "<<|>>|[-+*/&|^~#<>=!]"},
 {"name": sc("variable.other"), "match": "[A-Za-z_@][A-Za-z0-9_@]*"},
]
g = {
 "name": "NHL assembly (68000 + 65816)", "scopeName": "source.nhl-asm",
 "patterns": [{"include": "#comment"}, {"include": "#label"}, {"include": "#directive"},
              {"include": "#mnemonic"}, {"include": "#macrocall"}, {"include": "#operand"}],
 "repository": {
  "comment": {"patterns": [{"name": sc("comment.line.semicolon"), "match": ";.*$"},
                           {"name": sc("comment.line.star"), "match": "^\\*.*$"}]},
  "label": {"patterns": [
    {"match": "(?i)^([A-Za-z_@][A-Za-z0-9_@]*)(?=\\s+macro\\b)", "name": sc("entity.name.function.macro")},
    {"match": "(?i)^(\\s*macro\\s+)([A-Za-z_][A-Za-z0-9_]*)",
     "captures": {"1": {"name": sc("keyword.control.directive")}, "2": {"name": sc("entity.name.function.macro")}}},
    {"match": "(?i)^\\s*(!?[.?]?[A-Za-z_@][A-Za-z0-9_@.]*)(?=\\s+(?:equ|set|rs\\.[bwl])\\b|\\s*=(?!=))",
     "name": sc("variable.other.constant")},
    {"match": "^\\s*([.?]?[A-Za-z_@][A-Za-z0-9_@.]*)(:)",
     "captures": {"1": {"name": sc("entity.name.function.label")}, "2": {"name": sc("punctuation.separator")}}},
    {"match": "^([.?]?[A-Za-z_@][A-Za-z0-9_@.]*)(?=\\s|$|;)",
     "name": sc("entity.name.function.label")}]},
  "directive": {"patterns": [
    {"match": "(?i)(?<![\\w.$#!])(include|incbin|incsrc)(\\s+)([^\\s;,\"']+)",
     "captures": {"1": {"name": sc("keyword.control.directive")}, "3": {"name": sc("string.unquoted.path")}}},
    {"name": sc("keyword.control.directive"),
     "match": "(?i)(?<![\\w.$#!])(?:" + DR + ")" + SUF + "(?![\\w])"}]},
  "mnemonic": {"patterns": [{"name": sc("keyword.other.mnemonic"),
     "match": "(?i)(?<![\\w.$#!<?])(?:" + MN + ")" + SUF + "(?![\\w])"}]},
  "macrocall": {"patterns": [
    {"name": sc("entity.name.function.macro"), "match": "%[A-Za-z_][A-Za-z0-9_]*"},
    {"begin": "^(\\s+)(?!(?i:(?:" + DR + "|" + MN + ")" + SUF + ")(?:\\s|$|;))([A-Za-z_@][A-Za-z0-9_@]*)(?=\\s|$|;)",
     "beginCaptures": {"2": {"name": sc("entity.name.function.macro")}},
     "end": "(?=;)|$",
     "patterns": [{"include": "#comment"},
       {"name": sc("constant.numeric.hex"), "match": "(?<![\\w.$@])(?=[0-9A-Fa-f]*[0-9])[0-9A-Fa-f]+(?![\\w])"},
       {"include": "#operand"}]}]},
  "operand": {"patterns": operand},
 }}
json.dump(g, open(os.path.join(D, 'nhl-asm.tmLanguage.json'), 'w'), indent=2)
print('wrote nhl-asm.tmLanguage.json')
