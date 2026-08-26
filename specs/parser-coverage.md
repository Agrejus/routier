# Filter parser coverage

What `toExpression` can turn into an expression tree, and what it cannot.

Measured 2026-08-26 by running 46 predicates through the real parser against a real compiled
schema. **13 parse.** The rest return `not-parsable`, which sends the whole query — and every
option after it — to the memory execution target.

`core/src/expressions/coverage.test.ts` is that probe, kept as a characterisation test. It asserts
the CURRENT answer for each predicate, so widening the parser shows up as a deliberate diff rather
than as a silent change. Update it in the same commit as the parser.

## Why an unparsable filter matters

It is not a syntax error and nothing fails. The filter runs, correctly, in memory — after the
backend has returned every row. A bounded query quietly becomes a full read, and until recently
`.explain()` said only "not parsable" without showing which predicate it meant.

That is the cost of every "no" below.

## Supported

| category | form |
|---|---|
| string matching | `x.name.startsWith(v)`, `.endsWith(v)`, `.includes(v)` |
| casing | `x.name.toLowerCase()` / `.toUpperCase()` / the `toLocale*` pair — **only** as the target of the three above |
| length | `x.name.length`, `x.tags.length` (string and array) |
| array membership | `x.tags.includes(v)` |
| literal membership | `['a', 'b'].includes(x.name)` — becomes `IN (...)` |
| booleans | `x.active`, `!x.active`, `x.active === true` |
| optional chaining | `x.name?.length > 2` |
| comparison | `== === != !== > >= < <=`, either operand order |
| logic | `&&`, `\|\|` |

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

## Gaps, by what they would cost

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

### Free identifiers

`Math.abs(x.age)`, `typeof x.name === 'string'`, `x.createdAt > new Date(0)` all report
*"Cannot derive value from variable, please pass parameters in"*. The parser sees an identifier it
cannot evaluate and stops.

`new Date(0)` deserves its own line: comparing a date property against a constructed date is
completely ordinary, and it forces a full memory fallback today. The workaround is to pass the date
through params, which works — but nothing tells the caller that is why their query got slow.

### Probably right to refuse

`.split()`, `.join()`, `.replace()`, `.padStart()`, `.localeCompare()`, `.toFixed()`. These produce
values no index can use. Pushing them down would be slower than the memory fallback, and refusing
is the honest answer — provided `.explain()` says so, which it now does.

## Re-running

```
npx jest core/src/expressions/coverage.test.ts
```

A predicate that starts parsing will fail the test. That is the point: change the expectation in
the same commit, so the coverage map cannot drift from the parser.
