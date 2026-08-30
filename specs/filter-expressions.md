# Filter expressions

What a filter can be pushed down as today, the tree shape that represents everything else, and the
work between the two.

`core/src/expressions/coverage.test.ts` mirrors this, in three categories. Supported forms are
asserted. Every gap is an `it.todo` naming the predicate that SHOULD parse, so the work list shows up
on every test run. Every **refusal** below is asserted NOT to parse, so "must never be represented"
is a property the build enforces in both directions.

Implementing a todo means replacing it with a real test — never inverting an expectation.

## Why an unparsable filter matters

It is not a syntax error and nothing fails. The filter runs, correctly, in memory — after the
backend has returned every row. A bounded query quietly becomes a full read.

That is the cost of everything below.

## Supported today

Measured 2026-08-27, after all three pieces landed, by running predicates through the real parser
against a real compiled schema. `core/src/expressions/coverage.test.ts` asserts most rows; a few sub-clauses are covered by the
per-piece suites instead.

| category | form |
|---|---|
| comparison | `== === != !== > >= < <=`, either operand order |
| logic | `&&`, `\|\|`, parenthesised groups, `!(a && b)`, chains of any length |
| string matching | `.startsWith(v)`, `.endsWith(v)`, `.includes(v)`, including on a nested property |
| casing | `.toLowerCase()` / `.toUpperCase()` / the `toLocale*` pair, under **any** comparator and on either side |
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
| tautology | `x => true` parses to `empty`, which `toSql` renders `1 = 1`. A params comparison that settles true folds to the same thing |
| arithmetic | `+ - * / % **`, on properties, params and literals |
| bitwise | `& \| ^ ~ << >> >>>`, bracketed — an unbracketed mix with a comparison is refused, because JavaScript reads it the other way round. Parses, but no engine claims it: see "What each engine claims" |
| conditional | `(c ? a : b)` as a value, and inside an interpolation |
| coalescing | `(x.name ?? '')` |
| pattern | `/^a/.test(x.name)` |
| templates | `` `${p.prefix}a` `` — interpolation, folded to `concat`; a lone `${x.age}` converts to string |
| calls on a group | `(x.name).toLowerCase()`, `(x.age + 1).length`, and chains of them |
| destructuring | `({ name }) => …`, `([{ name }, { min }]) => …`, renamed and nested keys |
| declarations | `const`/`let`/`var` before the return, including one reading another |
| control flow | `if` / `else if` / `else` with returns, and `switch` with `case`, fallthrough labels and `default` |

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

**A plugin hands back what its engine cannot express.** Every query option already carries a
`target` of `"database"` or `"memory"`, and `postProcessQuery` already runs the memory half over
whatever the plugin returned — *"operations on the result that the plugin will not do"*. So a plugin
that meets a call it cannot render flips that option's target and returns the rows it could get; the
datastore runs the rest. Nothing fails, nothing is retried, and `IDbPlugin` stays at four members.

```ts
// in the plugin, before translating
options.reportMissingCapability(item);
```

`reportMissingCapability` takes everything AFTER the option with it. A `take` already applied by the database,
in front of a filter the database did not apply, returns the wrong rows — so the cut is forward-only,
the same rule `cutOverToMemory` follows when core decides for itself.

Only the plugin can make this call. SQLite's `REGEXP` exists if the host registered the function and
not otherwise, so two instances in one process can differ; PostgreSQL spells it `~`; MySQL has
`REGEXP` built in. `SqlDialect.renders(call)` declares it per dialect, and `canRenderInSql` walks a
filter to answer before anything is pushed down — asking rather than attempting, because attempting
costs a rejected statement and a wasted round trip.

`.explain()` gives the reported option the reason `missing-capability` and every option after it
`not-reached`, so a query that got slower says which option did it.

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

**Done.** Every operator JavaScript has that a filter can contain now parses, at JavaScript's own
precedence and associativity:

| form | call | note |
|---|---|---|
| `+ - * / %` | `add` … `modulo` | left-associative |
| `**` | `power` | RIGHT-associative: `2 ** 3 ** 2` is 512, not 64 |
| `& \| ^ ~ << >> >>>` | `bit-and` … `shift-right-unsigned` | `&` binds tighter than `\|`, both looser than the shifts |
| `a ?? b` | `coalesce` | falls back on `null` and `undefined`, not on `""` |
| `a ? b : c` | `conditional` | the condition is a boolean, the branches are values |
| `/^a/.test(x)` | `matches` | the pattern is a tagged value, the property is the operand |
| `` `${p.a}b` `` | `concat` | each `${…}` is parsed by its own stream, so it can hold anything |
| `123n` | — | a tagged value; `JSON.stringify` throws on a bigint outright |

Two lexical decisions worth knowing. A `/` opens a regex unless it follows a value — a number, string,
identifier, `)` or `]` — which is the rule a JavaScript lexer uses and is how `x.a / 2` and
`/^a/.test(x.a)` share a character. And a parenthesised group is read as a boolean unless a comparator
follows its closing bracket, decided by looking ahead rather than by parsing one way and catching the
failure: rewinding on an exception swallowed a genuine syntax error inside the group and reported it
as something else.

### What each engine claims

`SqlDialect.renders(call)` declares it, and a plugin asks `canRenderInSql` before translating. An
option no dialect claims is reported as a missing capability and runs in memory — correct, and merely
slower.

| call | SQLite | PostgreSQL | MySQL | MSSQL | MQL |
|---|---|---|---|---|---|
| bitwise and/or/not | ❌ rendered, not claimed | ❌ rendered, `trunc` then cast to `bigint` | ❌ rendered, not claimed | ❌ rendered, not claimed | ❌ rendered, not claimed |
| bitwise xor | ❌ rendered from `\|` and `&` | ❌ rendered `#`, since `^` is exponentiation | ❌ rendered `^` | ❌ rendered `^` | ❌ rendered, not claimed |
| shifts | ❌ | ❌ rendered, not claimed | ❌ rendered, not claimed | ❌ | ❌ no operator |
| unsigned shift | ❌ | ❌ | ❌ | ❌ | ❌ |
| `power` | ❌ no `POWER` | ✅ | ✅ | ✅ | `$pow` |
| `coalesce` | ✅ | ✅ | ✅ | ✅ | `$ifNull` |
| `concat` | ✅ `\|\|`, unless an operand is a number | ✅ `\|\|` | ✅ `CONCAT` | ✅ `+` | `$concat` |
| `conditional` | rendered, not claimed | rendered, not claimed | rendered, not claimed | rendered, not claimed | `$cond` |
| casing | ✅ via a replaced `lower()`/`upper()` on `node:sqlite`, otherwise memory | ✅ | ✅ | ✅ | `$toLower` |
| `trim`, `absolute`, `round` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `floor`, `ceiling` | ❌ compile-time option | ✅ | ✅ | ✅ | ❌ |
| `matches` | ❌ `REGEXP` only if the host registered it | rendered, not claimed | rendered, not claimed | ❌ | `$regexMatch` — `i`/`m`/`s` only; `g` and `d` dropped; `y`/`u`/`v` not claimed |

A join asks the same question: `canPushDownJoin(join, dialect)` checks the inner side's filters
against the dialect. Without the dialect argument a join was the one route to a renderer for a call
the engine does not claim.

PostgreSQL has no bitwise operator for `double precision` — `operator does not exist: double
precision & unknown` — the same shape as the modulo problem, and fixed the same way, by narrowing the
operand.

**`conditional` and `matches` are rendered but claimed by no SQL dialect.** MQL claims both. PostgreSQL rejects a `CASE` whose
branches do not unify (`double precision and text cannot be matched`), and the `= true` wrapper a bare
boolean call carries returned no rows there. Both run in memory until each engine is checked against a
real server. The renderers stay, so claiming them later is a declaration change rather than new code.

A claim is proven by EXECUTING the rendered output against the engine over the value domain the
schema admits, not by rendering it. `test-utils/src/pluginContract.ts`'s "filter parity with
JavaScript" section is that proof: it asserts the pushed-down rows equal `rows.filter(predicate)`,
seeded with the values engines disagree on — a fractional operand, a non-ASCII name, an integral
REAL, a shift count over 32. A plugin that pushes down must agree; one that hands the filter back
passes trivially, so a wrong claim fails and an unclaimed call cannot.

Executed against SQLite and pglite. MySQL, MSSQL and MongoDB claims are unverified — no server —
and are the next thing to run.

### Refused rather than reinterpreted

JavaScript binds `&`, `|`, `^` and `??` LOOSER than a comparison; this grammar reads a comparison's
operands as values, which puts them tighter. `x.flags & 6 === 2` is `x.flags & (6 === 2)` in
JavaScript — 0, always falsy — and would be read here as `(x.flags & 6) === 2`, which is true for
`flags: 2`. So an ungrouped one is refused and the filter runs against the caller's own function,
which is right by construction. Brackets say which was meant. JavaScript itself makes an unbracketed `??`
mix with `&&` or `||` a syntax error for the same reason, though not one with a comparison.

### Still open

| form | why |
|---|---|
| `x.name.toLowerCase().length === 3` | a call chained onto a call |
| `x.name.startsWith(x.other.toLowerCase())` | a call inside a method argument |
| `x.tags.some(t => t === 'a')` | array iteration — see "Array elements" |
| `'name' in x` | should fold; the schema answers it |
| `typeof x.name === 'string'` | should fold; the schema answers it |
| `(x.age + 1) * 2 > 5` | a parenthesised group on the LEFT of an arithmetic operator. `groupIsValue()` takes a group as a value only when a comparator, `.` or `?.` follows the bracket. The mirror form `2 * (x.age + 1) > 5` parses |

Three shapes are refused rather than missing, and each has a reason: arithmetic that names no schema
property is a constant and should be folded by the caller, arithmetic used as a condition instead of
compared is not a boolean, and arithmetic inside a `startsWith`/`endsWith`/`includes` argument is not
supported yet.

## Piece 3 — parser policy

Ordinary JavaScript the parser refused. **The tree these produce is identical to what already
works**, so there was no translator work and no shape question — only the parser.

| form | how it reads |
|---|---|
| `({ name }) => name === 'a'` | a **scope** maps each identifier to a binding, and the entity parameter binds its own name to the empty property path — so `x.age` and a destructured `age` take one code path |
| `([{ name }, { min }]) => …` | the same, on either half of the entity/params pair, nested and renamed keys included |
| `{ const n = 3; return x.age > n; }` | a declaration binds its name to the **tokens** of its initializer, spliced in brackets at each use. Tokens rather than a parsed expression, so a binding works as an operand, an argument, or a call receiver |
| `{ if (c) return A; return B; }` | boolean algebra, not a conditional: `(c && A) \|\| (!c && B)`. Every common shape cancels a branch and needs no `!` at all — `if (c) return true; return false;` is just `c` |
| `switch` over a property | the disjunction of its cases. `case 'a': case 'b': return true` is one `\|\|` of two equality tests; a `default` is guarded by **every** case label failing, so a case whose body is `return false` still stops it |
| `p.a === p.b` | both sides resolve now, so the comparison is settled at parse time. A tautology folds to match-all and drops out of the filter |

Two forms stay OPEN — a gap, not a refusal, since none of the five reasons applies. **No expression
node means "match nothing"**, so `x => false`, and a constant comparison that settles the other way,
go to memory, which answers correctly and costs one round trip. `Expression.EMPTY` is the match-all
sentinel; its opposite would be a new node every translator has to claim. `coverage.test.ts` files
both as todos.

Three refusals are deliberate, because reading them would answer a question nobody asked:

- a block that falls off the end of an `if` — JavaScript returns `undefined` there, which is
  match-nothing again
- a `switch` whose case `break`s and then falls into statements written after the switch — that case
  answers with those statements, which a disjunction of cases cannot express
- a statement the reader has no rule for, `for` and `while` among them

Two things came along with it, because a spliced declaration needs them:

- **a call on a parenthesised value** — `(x.name).toLowerCase()`, `(x.age + 1).length`, and chains of
  them. Unlike a property chain, which carries at most one transform, any operand can receive a call
  here. The one new tree shape in Piece 3: a call whose operand is another call
- **a group followed by `.`** now reads as a value rather than a condition. Only the token after the
  closing bracket tells the two apart

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

**Bitwise operators are 32-bit in JavaScript and 64-bit everywhere else, so no engine claims them.**
`&`, `|`, `^`, `~` and the shifts coerce to a SIGNED 32-BIT integer in JavaScript, truncating the
fraction and wrapping past 2^31. No SQL engine does that:

| case | JavaScript | SQL |
|---|---|---|
| `5.5 & 1` | `1` — truncates to 5 | `1` on SQLite; PostgreSQL ROUNDED to 6 until `trunc` was added |
| `2147483648 \| 0` | `-2147483648` — wraps | `2147483648` |
| `4 << 40` | `1024` — the count is taken mod 32 | `4398046511104` |

`s.number()` admits every value in that table, so the divergence is inside the domain the schema
declares. The whole family is rendered and claimed by nobody: a bitwise filter runs in memory and
returns what the predicate means. Re-claiming needs an operand wrapper that reproduces `ToInt32`,
proven by a parity case with a wide value in it.

**A template over a null column.** `` `${x.other}!` `` with `other` null gives `"null!"` in
JavaScript and in the in-memory evaluator, and `NULL` from SQL's `||`, which excludes the row. SQL is
the odd one out. Wrapping concat operands in `COALESCE` per dialect would fix it, or concat could go
unclaimed for a nullable column.

**Strict equality used to coerce.** `x.age === "5"` rewrote the literal to the column's type, so
every engine — the in-memory evaluator included — answered the loose question, and `x.age !== "5"`
dropped a row the caller asked for. Fixed: a strict comparison whose literal type cannot match the
column runs in memory with `predicate-error`, and returns what JavaScript returns. Loose `==` and
`!=` still coerce, which matches JavaScript for numbers and strings — but not booleans, where
`isActive == 'true'` is false in JavaScript and true here.

**SQL is three-valued and JavaScript is not.** `WHERE` drops a row that answers UNKNOWN. `!=` and
`!==` against a nullable column are rendered null-safely — `IS NOT`, `IS DISTINCT FROM`, `<=>` — so a
null row is kept, as JavaScript keeps it. The rest of the family still diverges on SQL, verified:

| predicate | JavaScript | SQL |
|---|---|---|
| `x.n <= 3`, `n` null | keeps the row — null coerces to 0 | drops it |
| `!(x.n > 3)`, `n` null | keeps | drops — renders `<=` |
| `!x.other?.includes("b")`, null | keeps | drops — `NOT GLOB` |
| `x.n === x.n`, both null | keeps | drops — renders `"n" = "n"` |

Each needs a `COALESCE` decision that changes index behaviour, so each is its own call. MongoDB's
`$ne` matches null, but its negated relationals do not. The in-memory fallback answers all of them
correctly.

**Truthy shorthand is strict against a literal.** `x => x.age` compiles to `age === 1` and
`x => x.name` to `name === "true"`, not JavaScript truthiness. The string case matches almost nothing.
Verified; unfixed.

Everything else on the predicate list agrees across SQLite, PostgreSQL and every in-process plugin,
arithmetic included — and `test-utils/src/pluginContract.ts`'s "filter parity with JavaScript"
section is the executable form of this paragraph. MySQL, MSSQL and MongoDB are unverified: they need
a server, and the parity section is written to run against them the moment one is available.

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
| `const`, `let`, `var` before the return | have | the name binds to the tokens of its initializer, spliced in brackets at each use |
| `if` / `else if` / `else` with returns | have | rewritten as `(c && A) \|\| (!c && B)`, with constant branches cancelled |
| `switch` | have | rewritten as the disjunction of its cases, the `default` guarded by every label failing |
| a block that returns nothing | refuse | not-a-value. JavaScript answers `undefined`, which is match-nothing, and no node means that |
| a `break` that falls into statements after its `switch` | refuse | that case answers with those statements, which a disjunction of cases cannot express |
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

When a todo is implemented, replace it with a real assertion in the same
commit as the parser change, so this document and the parser cannot drift apart.
