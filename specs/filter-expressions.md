# Filter expressions

What a filter can be pushed down as today, the tree shape that represents everything else, and the
work between the two.

`core/src/expressions/coverage.test.ts` mirrors this. Supported forms are asserted; every gap is an
`it.todo` naming the predicate that SHOULD parse, so the work list shows up on every test run.
Implementing one means replacing its `todo` with a real test — never inverting an expectation.

## Why an unparsable filter matters

It is not a syntax error and nothing fails. The filter runs, correctly, in memory — after the
backend has returned every row. A bounded query quietly becomes a full read.

That is the cost of everything below.

## Supported today

Measured 2026-08-26 by running 113 predicates through the real parser against a real compiled
schema.

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

---

# The shape

**One new node** represents every gap on this page.

```ts
export class CallExpression extends Expression {
    readonly type = "call" as const;
    call: Call;                  // the operation, e.g. "to-lower-case", "absolute", "some"
    expression: Expression;      // what it is applied to. Always present.
    arguments: Expression[];     // operands. Always present, empty when there are none.
}
```

Both child slots are always present. A unary call has `arguments: []` — an empty list, not an
omitted slot. `left`/`right` stay where they belong: a genuinely symmetric binary relation, where
both sides are always filled and swapping them means something.

Everything else is subtraction:

| change | why |
|---|---|
| `transformer` and `locale` come off `PropertyExpression` and `ValueExpression` | a casing call becomes a `CallExpression` wrapping either one; the fields were a second representation of the same thing, duplicated again on the wire |
| `t` → `type` on the serialized form | the class field is `type`; the abbreviation earned nothing |
| the value tag becomes optional | absent means "the JSON value as it is". Only the four things `JSON.stringify` destroys carry one |
| the serialized keys mirror the class fields | `type`, `left`, `right`, `call`, `expression`, `arguments` — so the format is checkable against the classes at a glance |

## Values JSON cannot carry

`plugins/replication/src/HttpTransportDbPlugin.ts:121` does `JSON.stringify(body)` over `fetch`.
That is a shipped transport, so the tree must survive JSON, and JSON destroys four things a filter
value can legitimately be:

| value | `JSON.stringify` gives | tag |
|---|---|---|
| `Date` | an ISO string, indistinguishable from a string comparison | `{ "date": "…" }` |
| `undefined` | the key vanishes | `{ "undefined": true }` |
| `NaN`, `±Infinity` | `null` | `{ "number": "NaN" }` |
| `RegExp` | `{}` | `{ "regex": { "source": …, "flags": … } }` — not yet, arrives with Piece 2 |

An array is written as an array, with each element tagged only if it needs to be.

Everything else is written as itself. Structured clone would carry all four, but it does not exist
over HTTP, and it cannot carry the tree anyway — `PropertyExpression` holds a live `PropertyInfo`
with functions, and structured clone throws on a function.

The tag namespace cannot collide with a user value, because a plain object is already rejected as a
filter value (`core/src/expressions/types.ts:63`).

## Examples

```jsonc
// x.name.toLowerCase() === 'ada'
{ "type": "comparator", "comparator": "equals", "strict": true, "negated": false,
  "left":  { "type": "call", "call": "to-lower-case",
             "expression": { "type": "property", "path": "name" },
             "arguments": [] },
  "right": { "type": "value", "value": "ada" } }

// x.name.slice(0, 2) === 'ad'
{ "type": "comparator", "comparator": "equals", "strict": true, "negated": false,
  "left":  { "type": "call", "call": "substring",
             "expression": { "type": "property", "path": "name" },
             "arguments": [ { "type": "value", "value": 0 },
                            { "type": "value", "value": 2 } ] },
  "right": { "type": "value", "value": "ad" } }

// x.createdAt > new Date('2020-01-01')
{ "type": "comparator", "comparator": "greater-than",
  "left":  { "type": "property", "path": "createdAt" },
  "right": { "type": "value", "value": { "date": "2020-01-01T00:00:00.000Z" } } }

// x.tags.some(t => t === 'a')
{ "type": "call", "call": "some",
  "expression": { "type": "property", "path": "tags" },
  "arguments": [
    { "type": "comparator", "comparator": "equals", "strict": true, "negated": false,
      "left":  { "type": "property", "path": "tags" },
      "right": { "type": "value", "value": "a" } } ] }
```

Inside `some(tags)`, a reference to `tags` is the element. See "Array elements" for the object-array
case, which needs a schema change rather than a node.

---

# The work, in three pieces

These do not depend on each other and can land in any order. Only the first is about the tree.

## Prerequisite

Two rules, and the second is unresolved.

**Every generic walk goes through `childrenOf`.** `getProperties` and `forEach` recursed
`left`/`right`, which reaches every child of every node that existed before `call` and none of a
call's. `QueryOptionsCollection` uses `forEach` to find unmapped and renamed properties and cut the
query over to memory, so a property the walk cannot reach returns rows the caller excluded. Two
walkers outside core had the same shape and worse consequences: `datastore/src/transforms/index.ts`
skipped the encrypt/hash rewrite and compared plaintext against stored ciphertext, and
`plugins/replication/src/queryParamHelpers.ts` sent `value: undefined` over the wire. Both are fixed.

**A translator that cannot render a node must not push the filter down — and there is no mechanism
for it to say so.** `sql.ts:772` and `mql.ts:380` throw. Returning `null` instead is not a fix: every
`toSql` caller embeds the result in a statement, and a statement with no `WHERE` returns too many
rows rather than too few. The cut-over decision is made in `QueryOptionsCollection.add`, in core,
before any plugin sees the option, and core does not know which calls the plugin it is talking to can
render.

Until that is resolved, the invariant holds instead: **the parser emits a call only once every
translator renders it.** That is what the rest of the stack already assumes — `wire/query.ts` throws
rather than send a filter a receiver cannot apply. It leaves version skew as the live risk: a new
core with an older published plugin raises `Unknown expression type: call` instead of falling back.
Options, none chosen:

| option | cost |
|---|---|
| a translator exports the calls it renders; the datastore consults it before pushdown | no `IDbPlugin` change, but a second place to keep in step with each translator |
| the plugin catches the translator error and re-runs in memory | no contract change; a thrown error as control flow, and the plugin must be able to re-run |
| a capability member on `IDbPlugin` | direct, and against the contract's four-member rule |

## Piece 1 — the tree

`CallExpression` and the subtractions above. Touches `core/src/expressions/types.ts`, the parser,
and five consumers: `evaluate.ts`, `plugins/sql-core/src/sql.ts`, `plugins/mongodb/src/mql.ts`,
`core/src/plugins/query/describeFilter.ts`, `core/src/plugins/EphemeralDataPlugin.ts:37`.

1. **Done.** `CallExpression` + serialization, and the parser emits it for the three transform
   methods. `peelCalls` in `core/src/expressions/utils.ts` separates an operand from the calls
   applied to it, and `sql.ts`, `mql.ts` and the tests all use it rather than each keeping a copy.
2. **Done.** `transformer` and `locale` are gone from both nodes and from the wire. `Transformer`
   survives only as the parser's internal vocabulary of transform methods.
3. **Done, except one part that cannot be done.** `t` is `type`, and a value carries a tag only when
   JSON would destroy it.

   `toJson`/`fromJson` stay STATIC rather than becoming methods per class. A method requires an
   instance, and `Expression` is satisfied structurally here — `isExpression`
   (`core/src/assertions/index.ts:64`) tests a `type` string, callers hand-build object literals, and
   `explain.test.ts` drives a whole query option from one. `core/src/plugins/query/explain.ts:99`
   passes whatever it was given straight to `toJson`, so a method would throw
   `toJson is not a function` on the path whose test is named *"reports a value it cannot serialize
   instead of throwing"*. The same attempt on `children()` failed the same way, for the same reason.

   Nothing is lost. The goal was a serializer that knows the fields instead of discovering them, and
   a static switch on `type` is exactly that — the method-versus-static choice does not affect it.
4. **Done.** Both casing guards are lifted. `casingComparators.test.ts` exists in
   `core/src/expressions`, `plugins/sql-core/src` and `plugins/mongodb/src` — one per backend, over
   the same predicate list, which is what the guard was protecting.
5. Add call names one at a time, each retiring an `it.todo` in `coverage.test.ts`.

Two things learned while doing 1 and 2, both worth keeping:

- **A defaulted `calls` parameter is a trap.** `renderExprOperand(prop, calls = [])` let one call site
  forget the argument, and the transformer was silently dropped from `$regexMatch` — the exact
  failure the guard being lifted was written to prevent. Both translators take `calls` as a required
  parameter now, so an omission is a compile error.
- **An exhaustive list must be exhaustive by type.** `EXPRESSION_TYPES` was annotated
  `ExpressionType[]`, which does not require every member, so `call` was missing and `isExpression`
  rejected the new node. It is a `Record<ExpressionType, true>` now.

## Piece 2 — the tokenizer and grammar

The tree can hold these; the parser has to read the characters.

**Arithmetic is done.** `+ - * / %` parse with JavaScript precedence and left associativity, emit the
`add`/`subtract`/`multiply`/`divide`/`modulo` calls the union already had, and render in SQL, MQL and
the in-memory evaluator. The tokenizer needed nothing — those characters were already punctuation
tokens; only the grammar was missing. Verified against SQLite, PostgreSQL, pglite, MySQL, MongoDB,
PouchDB, Dexie, memory, file-system and browser-storage.

A call whose operands are all literals is folded at render time, so `x.age + 3 * 4` binds `12` rather
than asking the database to multiply two constants.

| form | current failure |
|---|---|
| `x.age ** 2` | no exponent operator |
| `x.age & 1`, `\|`, `^`, `~`, `<<`, `>>`, `>>>` | no bitwise operators |
| `a ? b : c` | `expected ')'` — no conditional operator |
| `a ?? b` | `expected ')'` — no nullish coalescing |
| `/^a/.test(x.name)` | `unexpected character '^'` — no regex literals |
| `` `${p.prefix}a` `` | interpolation unsupported; a plain template literal parses |
| `123n` | no bigint literal |

Nothing here needs a new node. Bitwise becomes `call`, the conditional becomes
`call: "conditional"`, `??` becomes `call: "coalesce"`, a regex literal becomes a tagged value, and
interpolation becomes `call: "concat"`.

Three shapes are refused rather than missing, and each has a reason: arithmetic that names no schema
property is a constant and should be folded by the caller, arithmetic used as a condition instead of
compared is not a boolean, and arithmetic inside a `startsWith`/`endsWith`/`includes` argument is not
supported yet.

## Piece 3 — parser policy

Ordinary JavaScript the parser refuses. **The tree these produce is identical to what already
works**, so there is no translator work and no shape question — only the parser.

| form | what it needs |
|---|---|
| `({ name }) => name === 'a'` | bind a destructured entity parameter |
| `([{ name }, p]) => …` | the same inside the entity/params pair |
| `{ const n = 3; return x.age > n; }` | inline a `const`/`let`/`var` binding, then parse the return |
| `{ if (x.age > 3) return true; return false; }` | rewrite `if`/`else` chains into `call: "conditional"` |
| `switch` over a property | rewrite into nested conditionals |
| `x => false` | a constant-false predicate. Leaving it in memory is correct; the only cost is a round trip |
| `p.a === p.b` | references no schema property, so it is constant per execution. Fold to match-all or match-none |

## The casing guards, and what lifting them enabled

Both are gone. They refused a casing call on anything but `startsWith`/`endsWith`/`includes`, on the
grounds that *"on relational comparators the plugins would silently ignore them and return wrong
data"* — which had stopped being true, and which made `renderColumn`'s `LOWER` path for those
comparators unreachable.

Now parsing and pushing down:

| predicate | SQL | Mongo |
|---|---|---|
| `x.name.toLowerCase() === 'ada'` | `LOWER("name") = ?` | `$expr` + `$toLower` |
| `x.name.toUpperCase() > 'M'` | `UPPER("name") > ?` | `$expr` + `$toUpper` |
| `x.name.toLowerCase() === x.other.toLowerCase()` | `LOWER("name") = LOWER("other")` | `$toLower` both sides |
| `x.name === x.other.toLowerCase()` | `"name" = LOWER("other")` | `'$name'` vs `$toLower` |
| `x.name === 'ADA'.toLowerCase()` | `"name" = ?` binding `ada` | a plain field predicate |

A call on the value side is still folded before binding, so the database never sees `LOWER(?)`.

Two forms remain unsupported, and are `todo`s rather than refusals: a call chained onto a call
(`x.name.toLowerCase().length === 3`) and a call inside a method argument
(`x.name.startsWith(x.other.toLowerCase())`).

---

# Where a backend disagrees with JavaScript

**MySQL ignores case in every string comparison.** The default collation is `utf8mb4_0900_ai_ci` —
case- and accent-insensitive — so `'Bravo' = 'bravo'` is true before any `LOWER()` is involved. A
filter pushed down to MySQL can therefore return rows the in-memory fallback excludes, and it does so
for plain equality as much as for a casing call. Verified against MySQL 8:

```
select @@collation_database          -> utf8mb4_0900_ai_ci
'Bravo' = 'bravo'                    -> true
LOWER('Bravo') = 'Bravo'             -> true
```

This predates calls entirely; a casing call only makes it visible. A schema that needs JavaScript's
answer has to declare a `_bin` or `_as_cs` collation on the column. Pinned in
`e2e/src/mysqlCasing.test.ts` rather than asserted away.

**`%` is not universal, so every dialect spells remainder differently.** PostgreSQL has no `%`
operator for `double precision` — a filter on a numeric column failed with *"operator does not exist:
double precision % unknown"* — MSSQL's `%` rejects `float`, and SQLite's truncates both operands to
integers, so its `10.5 % 3` is `1`. All three are wrong in different ways, and all three are handled
by `SqlDialect.moduloExpression`:

| dialect | remainder | why |
|---|---|---|
| SQLite | `(a - b * CAST(a / b AS INTEGER))` | `%` truncates to integer |
| PostgreSQL | `MOD((a)::numeric, (b)::numeric)` | no `%` for `double precision` |
| MySQL | `(a % b)` | already matches |
| MSSQL | `((a) % CAST(b AS decimal(38, 10)))` | `%` rejects `float` |

`moduloExpression` takes **thunks**, not rendered strings, because rendering an operand binds it:
SQLite names each side twice, so `x.age * 2 % 3` binds `[2, 3, 2, 3]`. A placeholder is positional, so
reusing the text without rebinding would shift every parameter after it.

All four engines now agree with JavaScript, verified directly — `10.5 % 3` is `1.5` on SQLite,
PostgreSQL, MySQL and MongoDB — and the shared contract covers a fractional remainder end to end.

**Integer division.** On a column typed as an integer, PostgreSQL's `/` is integer division while
JavaScript's is not. The plugins store numbers as `double precision`, so this does not arise today; it
would the moment a schema declared an integer column.

Otherwise SQLite, PostgreSQL, MongoDB and every in-process plugin agree with JavaScript on the same
predicate list, arithmetic included.

# The JavaScript surface

Every form a filter predicate can contain. Scope: the ECMAScript expression and statement grammar,
plus every method reachable on the prototypes a schema type can produce — string, number, boolean,
`Date`, array, object.

## Verdicts

| code | meaning |
|---|---|
| **have** | works today |
| **call** | a `CallExpression`. Needs a name in the `Call` union and a render per backend |
| **value** | resolves to a literal at parse time |
| **parser** | parser-side only. The resulting tree is one that already works |
| **token** | needs tokenizer or grammar work first (Piece 2) |
| **fold** | the schema already answers it, so it should never reach a backend |
| **refuse** | must not be represented. Cites a reason below |

## Refusal reasons

Five, and every **refuse** below cites one.

| reason | why a filter cannot contain it |
|---|---|
| **mutates** | a predicate that changes the row it is testing has no meaning once pushed down, and changes results when it runs in memory instead |
| **non-deterministic** | `toExpression` caches a parsed template keyed on function source. A value that differs per call would be frozen at first parse and stale forever |
| **async** | filtering is synchronous at every layer. There is nowhere to await |
| **not-a-value** | produces no operand — a declaration, a jump, a statement used for effect |
| **environment** | the answer depends on the host's locale, timezone or collation, so the backend and the memory fallback would disagree |

## Tier 3

A call no backend can render still gets a node. The tree records what was asked, so `.explain()` can
say *"`x.name.normalize()` could not be pushed down"* instead of printing the whole closure. Only
the five reasons above justify producing no node at all.

## Operators

| form | verdict | maps to |
|---|---|---|
| `&&`, `\|\|` | have | `OperatorExpression` |
| `!`, `!!` | have | negation |
| `===`, `!==`, `==`, `!=` | have | `ComparatorExpression` (`strict` records which) |
| `<`, `>`, `<=`, `>=` | have | `ComparatorExpression` |
| `?.` | have | optional chaining is already parsed |
| unary `-` | have | negative literals parse |
| `+`, `-`, `*`, `/`, `%` | token + call | `add`, `subtract`, `multiply`, `divide`, `modulo` |
| `**` | token + call | `power` |
| `??` | token + call | `coalesce` |
| `? :` | token + call | `conditional`, condition in `expression`, branches in `arguments` |
| `&`, `\|`, `^`, `~`, `<<`, `>>`, `>>>` | token + call | `bit-and`, `bit-or`, `bit-xor`, `bit-not`, `shift-left`, `shift-right`, `shift-right-unsigned`. Every SQL engine has these |
| `typeof` | call + fold | `type-of`. The schema declares the type, so `typeof x.name === 'string'` is statically known and should fold |
| `in` | fold | `'name' in x` is answered by the schema |
| `instanceof` | refuse | not-a-value. Prototype identity does not survive serialization and has no backend meaning |
| `void` | refuse | not-a-value. Always `undefined`; the operand is evaluated only for effect |
| `delete` | refuse | mutates |
| `=`, `+=`, `&&=`, `\|\|=`, `??=`, and every compound form | refuse | mutates |
| `++`, `--` (prefix and postfix) | refuse | mutates |
| `,` (sequence) | refuse | not-a-value. Only the last operand contributes, so the rest are dead code or side effects |
| `await` | refuse | async |
| `yield`, `yield*` | refuse | not-a-value |

## Literals and primary expressions

| form | verdict | notes |
|---|---|---|
| number, string, boolean, `null` | have | |
| `undefined` | have | tagged on the wire |
| array literal | have | `['a','b'].includes(x.name)` becomes `IN (…)` |
| plain template literal | have | no interpolation |
| template literal with `${}` | token + call | `concat` |
| regex literal | token + value | tagged `{ regex: { source, flags } }` |
| bigint literal `123n` | token + value | needs a `{ bigint: "…" }` tag; `JSON.stringify` throws on a bigint |
| `Infinity`, `-Infinity`, `NaN` | value | tagged on the wire |
| `Number.MAX_SAFE_INTEGER` and siblings | value | |
| `Math.PI`, `Math.E`, and the other six constants | value | |
| `new Date(<literal>)` | value | a constructed constant. Deterministic, so caching it is safe |
| `new Date()` — no arguments | refuse | non-deterministic |
| `Date.now()` | refuse | non-deterministic |
| object literal | refuse | not-a-value as an operand; a plain object is not a filter value |
| `this` | refuse | not-a-value. A predicate has no receiver |
| arrow / `function` expression | parser | valid only as the predicate argument of `some`/`every`/`find`/`filter`/`map` |
| `class` expression | refuse | not-a-value |
| tagged template | refuse | not-a-value. The tag is an arbitrary function |
| spread `[...xs]`, `f(...xs)` | parser | expand at parse time when the operand is a literal array or a param; otherwise refuse |
| `new X()` for anything but `Date` | refuse | not-a-value |
| `new.target`, `import.meta` | refuse | not-a-value |

## Statements, in a block body

| form | verdict | notes |
|---|---|---|
| a single `return` | have | |
| `const`, `let`, `var` before the return | parser | inline the binding |
| `if` / `else if` / `else` with returns | parser | rewrite to `conditional` |
| `switch` | parser | rewrite to nested `conditional` |
| a bare block `{ … }` | parser | unwrap |
| `for`, `for…of`, `for…in`, `while`, `do…while` | refuse | not-a-value. A loop in a predicate has no query equivalent; iteration over a property belongs to `some`/`every` |
| `try` / `catch` / `finally` | refuse | not-a-value. A query has no exceptions to catch |
| `throw` | refuse | not-a-value |
| labeled statement, `break`, `continue` | refuse | not-a-value |
| nested function or class declaration | refuse | not-a-value |
| `debugger`, `with` | refuse | not-a-value |

## String

`length` is a property, not a call, but produces the same node.

| method | verdict | call | SQL | Mongo |
|---|---|---|---|---|
| `length` | have | `length` | `LENGTH` | `$strLenCP` |
| `toLowerCase`, `toUpperCase` | have* | `to-lower-case`, `to-upper-case` | `LOWER`, `UPPER` | `$toLower`, `$toUpper` |
| `toLocaleLowerCase`, `toLocaleUpperCase` | have* | same, locale as `arguments[0]` | `LOWER` | `$toLower` |
| `startsWith`, `endsWith`, `includes` | have | comparators today | `LIKE`/`GLOB` | `$regex` |
| `trim` | call | `trim` | `TRIM` | `$trim` |
| `trimStart`, `trimEnd` | call | `trim-start`, `trim-end` | `LTRIM`, `RTRIM` | `$ltrim`, `$rtrim` |
| `indexOf` | call | `index-of` | `INSTR` / `POSITION` / `CHARINDEX` | `$indexOfCP` |
| `lastIndexOf` | call | `last-index-of` | dialect-specific | — |
| `slice`, `substring`, `substr` | call | `substring` | `SUBSTR` / `SUBSTRING` | `$substrCP` |
| `charAt`, `at` | call | `substring` with length 1 | `SUBSTR` | `$substrCP` |
| `charCodeAt`, `codePointAt` | call | `char-code` | `UNICODE` / `ASCII` | — |
| `concat` | call | `concat` | `\|\|` / `CONCAT` | `$concat` |
| `replace`, `replaceAll` | call | `replace`, `replace-all` | `REPLACE` | `$replaceOne`, `$replaceAll` |
| `padStart`, `padEnd` | call | `pad-start`, `pad-end` | `LPAD`, `RPAD` | — |
| `repeat` | call | `repeat` | `REPEAT` | — |
| `split` | call | `split` | dialect-specific | `$split` |
| `match`, `matchAll`, `search` | call | `matches` | `REGEXP` where present | `$regexMatch` |
| `normalize` | call | `normalize` — Tier 3 | — | — |
| `isWellFormed`, `toWellFormed` | call | Tier 3 | — | — |
| `toString`, `valueOf` | call | `to-string` | `CAST` | `$toString` |
| `localeCompare` | refuse | | | environment — collation differs between host and engine |
| `toLocaleString` with no explicit locale | refuse | | | environment |
| `anchor`, `big`, `blink`, `bold`, `fixed`, `fontcolor`, `fontsize`, `italics`, `link`, `small`, `strike`, `sub`, `sup` | refuse | | | not-a-value. Legacy HTML wrappers, no query meaning |

\* parses today only as the target of `startsWith`/`endsWith`/`includes`. The guards at
`parser.ts:1016` and `:911` block every other comparator; Piece 1 step 4 lifts them.

## Number

| method | verdict | call | notes |
|---|---|---|---|
| `toFixed` | call | `round-to` | `ROUND(c, n)` in SQL, then compared as text |
| `toPrecision`, `toExponential` | call | Tier 3 | no direct equivalent |
| `toString` | call | `to-string` | `CAST`; a radix argument is Tier 3 |
| `valueOf` | parser | | identity, so drop it |
| `toLocaleString` | refuse | | environment |

## Math

Constants (`PI`, `E`, `LN2`, `LN10`, `LOG2E`, `LOG10E`, `SQRT2`, `SQRT1_2`) are **value**.

| method | verdict | call | SQL | Mongo |
|---|---|---|---|---|
| `abs` | call | `absolute` | `ABS` | `$abs` |
| `floor`, `ceil`, `round`, `trunc` | call | `floor`, `ceiling`, `round`, `truncate` | same names | `$floor`, `$ceil`, `$round`, `$trunc` |
| `sign` | call | `sign` | `SIGN` | — |
| `sqrt`, `cbrt` | call | `square-root`, `cube-root` | `SQRT` | `$sqrt` |
| `pow` | call | `power` | `POWER` | `$pow` |
| `exp`, `log`, `log2`, `log10`, `expm1`, `log1p` | call | `exponent`, `log`, … | `EXP`, `LN`, `LOG` | `$exp`, `$ln`, `$log` |
| `min`, `max` | call | `minimum`, `maximum` | `MIN` / `LEAST` | `$min`, `$max` |
| `hypot`, `fround`, `imul`, `clz32` | call | Tier 3 | — | — |
| `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`, and the `*h` hyperbolics | call | Tier 2 | present in most engines | `$sin`, `$cos`, … |
| `random` | refuse | | | non-deterministic |

## Date

Every getter is a **call**. `getTime` and `valueOf` are the same operation.

**Date parts are UTC.** A local part is environment-dependent, and the refusal reasons below already
rule that out: `EXTRACT(YEAR …)` runs in the engine's timezone and `evaluate.ts` runs in the host
process's, so a row near a year boundary would be included by one and excluded by the other. The
local getters are therefore refused, and Mongo is UTC natively.

| method | verdict | call | SQL | Mongo |
|---|---|---|---|---|
| `getTime`, `valueOf` | call | `epoch-ms` | dialect-specific | `$toLong` |
| `getUTCFullYear` | call | `utc-year` | `EXTRACT(YEAR …)` at UTC | `$year` |
| `getUTCMonth` | call | `utc-month` | `EXTRACT(MONTH …)` at UTC | `$month` |
| `getUTCDate` | call | `utc-day-of-month` | `EXTRACT(DAY …)` at UTC | `$dayOfMonth` |
| `getUTCDay` | call | `utc-day-of-week` | `EXTRACT(DOW …)` at UTC | `$dayOfWeek` |
| `getUTCHours`, `getUTCMinutes`, `getUTCSeconds`, `getUTCMilliseconds` | call | `utc-hour`, `utc-minute`, `utc-second`, `utc-millisecond` | `EXTRACT` at UTC | `$hour`, … |
| `getFullYear`, `getMonth`, `getDate`, `getDay`, `getHours`, `getMinutes`, `getSeconds`, `getMilliseconds` | refuse | | | environment — the host timezone, which the engine does not share |
| `toISOString`, `toJSON` | call | `to-iso-string` | `CAST` / `strftime` | `$dateToString` |
| `getTimezoneOffset` | refuse | | | environment |
| `toString`, `toDateString`, `toTimeString`, `toUTCString` | refuse | | | environment — host-format dependent |
| `toLocaleString`, `toLocaleDateString`, `toLocaleTimeString` | refuse | | | environment |
| every `set*` | refuse | | | mutates |
| `getYear`, `setYear` | refuse | | | not-a-value. Legacy, two-digit years |

## Array

| method | verdict | call | notes |
|---|---|---|---|
| `length` | have | `length` | `json_array_length` / `$size` |
| `includes` | have | | a comparator today; `arrayContainsExpression` per dialect |
| `some` | call | `some` | `EXISTS (SELECT 1 FROM json_each(c) …)` / `$elemMatch` |
| `every` | call | `every` | `NOT EXISTS (… WHERE NOT …)`. `[].every(…)` is `true` and `NOT EXISTS` over zero rows is also true, so the empty case needs no special handling |
| `find`, `findLast` | parser | rewrite to `some` when compared `!= null` | |
| `findIndex`, `findLastIndex` | call | Tier 3 | position in a JSON array is expressible but not usefully indexed |
| `indexOf`, `lastIndexOf` | call | `index-of` | |
| `filter` | call | `filter` | only meaningful when its result is measured, e.g. `.filter(p).length > 0` — which is `some` |
| `at` | call | `element-at` | |
| `join` | call | `join` | `group_concat` / `$reduce` |
| `flat`, `flatMap`, `concat` | call | Tier 3 | |
| `map` | call | Tier 3 | a projection, not a predicate. Gets a node so `.explain()` can name it, but no backend renders it in a filter |
| `toReversed`, `toSorted`, `toSpliced`, `with` | call | Tier 3 | non-mutating, so representable |
| `reduce`, `reduceRight` | refuse | | not-a-value. The accumulator is an arbitrary closure |
| `forEach` | refuse | | not-a-value. Returns `undefined`; used only for effect |
| `entries`, `keys`, `values` | refuse | | not-a-value. Iterators do not serialize |
| `sort` | refuse | | mutates. `toSorted` is the representable form |
| `reverse`, `push`, `pop`, `shift`, `unshift`, `splice`, `fill`, `copyWithin` | refuse | | mutates |
| `toString`, `toLocaleString` | refuse | | environment |

## Object, JSON, RegExp, and globals

| form | verdict | notes |
|---|---|---|
| `Boolean(x)`, `Number(x)`, `String(x)` | call | `to-boolean`, `to-number`, `to-string`. `CAST` in SQL, `$convert` in Mongo |
| `parseInt`, `parseFloat` | call | `to-number`, radix as an argument |
| `isNaN`, `isFinite`, `Number.isNaN`, `Number.isFinite` | call | `is-nan`, `is-finite` |
| `Number.isInteger`, `Number.isSafeInteger` | call | `is-integer` |
| `Array.isArray` | fold | the schema declares it |
| `RegExp.prototype.test`, `.exec` | call | `matches` |
| `Object.keys`, `.values`, `.entries` | call | Tier 3 for a JSON column; **fold** on the entity itself, where the schema answers it |
| `Object.hasOwn`, `hasOwnProperty` | fold | the schema answers it |
| `Object.assign`, `.freeze`, `.defineProperty`, `.setPrototypeOf` | refuse | mutates |
| `JSON.stringify` | call | Tier 3 |
| `JSON.parse` | refuse | not-a-value. Parsing text into a structure inside a predicate has no query equivalent |
| `encodeURIComponent`, `decodeURIComponent`, `encodeURI`, `decodeURI`, `btoa`, `atob` | call | Tier 3 |
| `Symbol`, `BigInt`, `Proxy`, `Reflect`, `Map`, `Set`, `WeakMap` | refuse | not-a-value |
| `structuredClone` | refuse | not-a-value |
| `globalThis`, `window`, `document`, `process`, `require`, `import()` | refuse | not-a-value |
| a free variable closed over from the enclosing scope | refuse | non-deterministic. Its value is not visible to the parser and not stable across calls. This is the case the "please pass parameters in" message is for, and it should keep saying so |

---

# Array elements

Object arrays are the one item needing work outside the parser and the translators.

`x.orders.some(o => o.total > 100)` needs `o.total` to be a resolvable path. It is not — probed
against a real compiled schema:

```
tags           FOUND type=Array
orders         FOUND type=Array
orders.total   NOT resolvable
orders.sku     NOT resolvable
```

The schema's property map stops at the array. `PropertyInfo.children` exists
(`core/src/schema/PropertyInfo.ts:73`); the children of an array's element type are simply not
registered.

Two steps, in this order:

1. **Scalar arrays first.** `x.tags.some(t => t === 'a')` needs nothing new — inside `some(tags)`, a
   reference to `tags` is the element. This is the case that generalizes today's
   `x.tags.includes('a')`.
2. **Then register element paths** so `orders.total` resolves like any nested path, and object arrays
   become ordinary `PropertyExpression`s. This is a schema-compiler change, and anything that
   enumerates properties — selects, storage columns, change tracking — will start seeing the new
   paths. Each needs checking before it is called safe.

Known hole in step 1: inside `some(tags)`, a reference to `tags` means the element, so
`x.tags.some(t => x.tags.length > 2)` is misread. Rare, detectable, and closed by step 2.

# Open decisions

**Arithmetic as a call, or as a widened `Operator`.** `x.age + 1` as a call is
`{ call: "add", expression: <age>, arguments: [1] }` — asymmetric slots for a symmetric operation.
Adding `+ - * / %` to the `Operator` union instead uses `OperatorExpression`'s `left`/`right`, which
is symmetric and adds no node — but it widens that node from "boolean logic" to "any binary
operator", changing what its children mean. Recorded as a call above.

**Tier 2 calls that produce a computed value.** `replace`, `padStart`, `split`, `toFixed` and the
trigonometric functions all push down correctly and all defeat every index, so pushing them down may
be slower than the memory fallback they replace. They are representable either way; whether a
translator should emit them is a per-backend judgement, and `.explain()` now reports when one of them
sent a query to memory, so the cost is visible.

# Re-running the measurement

```
npx jest core/src/expressions/coverage.test.ts
```

54 assertions and 49 todos. When a todo is implemented, replace it with a real assertion in the same
commit as the parser change, so this document and the parser cannot drift apart.
