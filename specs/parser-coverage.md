# Filter parser coverage

What `toExpression` can turn into an expression tree, and what it cannot.

Measured 2026-08-26 by running 113 predicates through the real parser against a real compiled
schema. The parser handles considerably more than a first pass suggested — nested paths, null
handling, params, block bodies, bracket access — and the gaps that remain fall into a handful of
root causes rather than a long list of missing methods.

`core/src/expressions/coverage.test.ts` mirrors this. Supported forms are asserted; every gap is an
`it.todo` naming the predicate that SHOULD parse, so the work list shows up on every test run.
Implementing one means replacing its `todo` with a real test — never inverting an expectation.

Nothing here is a decision not to support something. It is a list of what is not done yet.

`specs/expression-shape.md` is the other half: this document measures what the parser does, that one
gives the tree shape that represents all of it and divides the work into three separable pieces.

## Why an unparsable filter matters

It is not a syntax error and nothing fails. The filter runs, correctly, in memory — after the
backend has returned every row. A bounded query quietly becomes a full read, and until recently
`.explain()` said only "not parsable" without showing which predicate it meant.

That is the cost of everything in the second half of this document.

## Supported today

More than a first pass suggests.

| category | form |
|---|---|
| comparison | `== === != !== > >= < <=`, either operand order |
| logic | `&&`, `\|\|`, parenthesised groups, `!(a && b)`, chains of any length |
| string matching | `.startsWith(v)`, `.endsWith(v)`, `.includes(v)`, including on a nested property |
| casing | `.toLowerCase()` / `.toUpperCase()` / the `toLocale*` pair — **only** as the target of the three above |
| length | `x.name.length`, `x.tags.length`, `x.address.city.length` |
| array membership | `x.tags.includes(v)` |
| literal membership | `['a', 'b'].includes(x.name)` — becomes `IN (...)` |
| booleans | `x.active`, `!x.active`, `!!x.active`, `x.active === false` |
| nested properties | `x.address.city`, `x.address.zip.code` — two levels deep |
| optional chaining | `x.name?.length`, `x.address?.zip?.code` |
| null and undefined | `=== null`, `!== null`, `!= null`, `=== undefined`, null on either side |
| values | zero, floats, negatives, empty strings, strings containing quotes |
| property to property | `x.name === x.id`, including relational comparators |
| params | `p.min`, nested `p.range.min`, one param used twice, param arrays in `includes`, `Date` params |
| syntax | block body with a single `return`, bracket access `x['name']`, plain template literals, comments, unary minus |
| tautology | `x => true` parses to `empty`, which `toSql` renders `1 = 1` |

## The stale guard

```
x.name.toLowerCase() === 'ada'
  -> Unsupported expression format: transform method outside of startsWith/endsWith/includes
```

Thrown at `parser.ts:1016`, with the reason stated beside it: *"on relational comparators the
plugins would silently ignore them and return wrong data"*.

**That is no longer true.** Every consumer implements transformers on any comparator:

| consumer | where |
|---|---|
| `toSql` | `renderColumn` wraps the column in `LOWER(...)` / `UPPER(...)` for every comparator |
| `toMql` | the `$expr` path, with `$toLower` / `$toUpper` |
| `evaluate.ts` | `applyTransformer`, lines 36-56, applied to property expressions at line 74 |

So the parser refuses to produce a tree the whole stack can already handle, and `toSql`'s `LOWER`
path for relational comparators is **unreachable today**. The same guard fires at `parser.ts:911`
for a property-to-property comparison.

Lifting it needs one test per backend proving SQL, Mongo and the in-memory evaluator agree on the
same predicate — that agreement is the thing the guard was protecting, and it is now testable
rather than assumed.

## To support, grouped by root cause

Several of these are ONE fix. The grouping matters more than the count.

### Direct equivalents everywhere

Each is a parser table entry plus a render in three translators. Nothing structural.

| predicate | SQL | Mongo |
|---|---|---|
| `.trim()` | `TRIM()` | `$trim` |
| `.indexOf(v)` | `INSTR` / `POSITION` | `$indexOfCP` |
| `.slice(a, b)`, `.substring(a, b)`, `.charAt(i)`, `.at(i)` | `SUBSTR()` | `$substrCP` |
| `Math.abs/floor/ceil/round` | same names | `$abs`, `$floor`, `$ceil`, `$round` |
| Date `.getFullYear()`, `.getTime()`, `.getMonth()` | `EXTRACT` / `strftime` | `$year`, `$month` |

### Array iteration — a different shape

`x.tags.some(t => t === 'a')`, `.every(...)`, `.find(...)`. A nested predicate over elements, not a
value transform. SQL needs `EXISTS (SELECT 1 FROM json_each(...) WHERE ...)`; Mongo has
`$elemMatch`. `some` over an array property is an ordinary thing to write and currently forces a
full read.

### Grammar, not the method table

These fail in the tokenizer or the grammar, so no lookup entry can fix them:

| form | error |
|---|---|
| `x.age % 2 === 0`, `x.price * 1.2 > 100`, `x.age + 1 > 3` | `unexpected token '%'` / `'*'` / `'+'` — **no arithmetic at all** |
| `(x.age > 5 ? x.name : '') === 'ada'` | `expected ')'` — no conditional operator |
| `(x.name ?? '') === 'ada'` | `expected ')'` — no nullish coalescing |
| `/^a/.test(x.name)` | `unexpected character '^'` — no regex literals |
| `'name' in x` | a filter condition must reference a schema property |
| `[...names].includes(x.name)` | `.` — no spread |
| `` `${p.prefix}a` `` | template literal interpolation — plain template literals DO parse |

### Free identifiers — the biggest single group

The parser has no notion of globals. Any identifier it cannot resolve to the entity or the params
object fails identically with *"Cannot derive value from variable, please pass parameters in"*:

`Math.abs` · `Math.floor` · `Math.ceil` · `Math.round` · `Number.isInteger` · `Boolean()` ·
`String()` · `Number()` · `typeof` · `Infinity` · `NaN` · `new Date(0)` · an `async` predicate

**One fix covers all of them**: a safe allow-list of globals the parser may constant-fold.

`new Date(0)` deserves its own line. Comparing a date property against a constructed date is
completely ordinary, and it forces a full memory fallback today. Passing the date through params
works — and nothing tells the caller that is why their query got slow.

### Function shapes

Ordinary JavaScript, refused. Parser-side only: the resulting tree would be identical to what the
supported form already produces, so there is no translator work.

| form | error |
|---|---|
| `({ name }) => name === 'a'` — destructured entity | Cannot derive value from variable |
| `{ const n = 3; return x.age > n; }` | block body without a single return statement |
| `{ if (x.age > 3) return true; return false; }` | block body without a single return statement |
| `p.a === p.b` — references no schema property | comparison requires a schema property on at least one side |

`x => false` is an asymmetry rather than a plain gap: `x => true` parses to the `empty` tautology
and `toSql` renders it `1 = 1`, but the match-nothing counterpart is refused and no part of the
stack has one.

### Supportable, but decide deliberately

`.split()`, `.join()`, `.replace()`, `.padStart()`, `.localeCompare()`, `.toFixed()`.

Each has a SQL equivalent (`REPLACE`, `SUBSTR`, `LPAD`) and a Mongo one, so "cannot" is the wrong
word. The question is whether it is worth it: each produces a computed value no index can use, so
pushing it down may be slower than the memory fallback it replaces. Worth deciding on purpose
rather than by omission — and `.explain()` now says when one of these sent a query to memory, so
the cost is at least visible.

## Re-running

```
npx jest core/src/expressions/coverage.test.ts
```

54 assertions and 49 todos. When a todo is implemented, replace it with a real assertion in the
same commit as the parser change, so this document and the parser cannot drift apart.
