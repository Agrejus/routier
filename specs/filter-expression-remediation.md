# Filter expression remediation

What three independent reviews of the `explain-predicates` work found, and the order to fix it in.

`specs/filter-expressions.md` is the feature spec. This document is the defect list against it. Every
finding here was reproduced by execution against `node:sqlite`, pglite, or the in-memory evaluator.
Cells marked *unverified* had no server available.

## The shape of the problem

The capability mechanism is sound. Two reviewers tried to break it and could not: a report cuts
forward-only, a plugin cannot produce a non-contiguous cut, `cutOverToMemory` is a ratchet, and
`CacheDbPlugin` never stores a partial answer.

Three things around it fail.

| band | what is wrong |
|---|---|
| the report is ignored | builders honour `reason`; the result translator, the join route and the SELECT list do not |
| the dialects lie | a dialect claiming a call it renders wrongly produces a silently wrong query with no fallback |
| the tree is not faithful | strict equality coerces, so `evaluate` agrees with the corrupted tree |

## Why 2,228 passing tests caught none of it

The shared fixture `PRODUCTS` is integral, small and ASCII — the one value domain where every engine
agrees with JavaScript by accident. Nothing runs a claimed call's SQL against a real engine and
compares the rows to `rows.filter(predicate)`.

`claimedCalls.test.ts` proves claim implies render does not throw. `piece2.test.ts:101` asserts the
claim *list* has the expected shape. Neither asserts a row.

## Decisions taken

### Do not make the database agree — detect that it will not, and do not send it

The cross-cutting decision, which replaces several one-off fixes below.

Where the database's answer would differ from JavaScript's, the option and everything after it run in
memory. The rows are then correct by construction, the console carries a warning, and `.explain()`
names the cause. This reuses the cascade the capability work already built rather than adding a
second mechanism.

Two reasons, because the two situations are not the same and a developer needs to know which one they
are looking at.

| reason | union | who marks it | means |
|---|---|---|---|
| `predicate-error` | `MemoryExecutionReason` | core, at parse | the filter itself is wrong. Fix the code |
| `engine-divergence` | `DatabaseExecutionReason` | the plugin | the engine cannot answer faithfully. Nothing the caller can do |

The split falls out of the existing architecture. `MemoryExecutionReason` is for what core knows up
front, and a literal whose type cannot match its column is knowable at parse with no engine involved.
`DatabaseExecutionReason` is for what only a plugin can report, which is exactly what engine fidelity
is: SQLite's ASCII folding is not knowable from core.

`predicate-error` joins the `cutOverToMemory` ratchet beside `after-nearest`. `engine-divergence` is
reported like `missing-capability`, so `notExecuted()` and the `not-reached` cascade already carry it.

**Warnings fire on every execution.** Loud by choice: this must be impossible to miss in
development. They go through `logger.warn`, so a host that needs quiet can lower the level.

### Strict equality (F-JS-1)

Rows `{age: 5}`, `{age: 9}`:

| filter | JavaScript | today | after |
|---|---|---|---|
| `x.age === "5"` | 0 rows | 1 row | 0 rows |
| `x.age !== "5"` | 2 rows | 1 row | 2 rows |

The filter runs in memory with `predicate-error`, so the answer is JavaScript's on every engine. The
warning names the column, its schema type, the literal and its type, and links to routier.dev.

Loose `==` / `!=` and relational comparators keep coercing. That matches JavaScript for numbers and
strings and is pinned by existing tests.

This supersedes the earlier plan to fold the comparator to `Expression.EMPTY`. Cutting to memory is
simpler, needs no match-none node, and gives the same rows. The cost lands only on a predicate that
is a caller mistake.

### SQLite casing (F-DIALECT-3)

Register a user-defined function on each SQLite driver implementing JavaScript `toLowerCase` /
`toUpperCase`, and render that instead of `lower()` / `upper()`.

Where a driver cannot register one, the plugin reports `engine-divergence` so the filter runs in
memory, and warns. Do not throw: the divergence only appears on non-ASCII data, and a throw would
break working applications.

D1 is the driver most likely to refuse a UDF. Confirm before wiring.

## Two docs pages to write

Both warnings link out, so routier.dev needs them. The docs site is VitePress.

1. **Why my `.toLowerCase()` filter misses rows on SQLite** — ASCII folding, which drivers register a
   UDF, what to do when yours cannot.
2. **Why my strict comparison returns nothing** — the type of a schema column versus the type of the
   literal, why `===` is honoured now, and the `==` migration.

## Phase 1 — the tree, and a green suite — DONE

The working tree was red: 14 tests failed, all from the uncommitted fold work. It is green now.

### F-FOLD-1 — the translators silently drop a value-side call

`plugins/sql-core/src/sql.ts:666,819` · `plugins/mongodb/src/mql.ts:191,306,397`

`valLeft` / `valRight` read `peeled.operand.value` and discard `peeled.calls`.

```
o.name === "ABC".toLowerCase()   →  "name" = ?  params ["ABC"]   (was ["abc"])
age === CallExpression(add,2,[3]) →  "age" = ?   params [2]       (the +3 vanishes)
```

The deleted `applyCallsToValue` threw here. The new code returns a valid query matching the wrong
rows. No live path is affected — every shipped plugin asks `canRender*` first — but `toSql` and
`toMql` are exported, so the guarantee moved from the type system to a convention.

Fix: one core helper, `foldedOperandValue(operand, calls)`, which computes the chain or throws, plus
five call-site edits. `peelCalls` returns calls innermost-first, so evaluating the last element
evaluates the whole chain. The `readsAProperty` guard is load-bearing: `operandValue` resolves a
property against `{}` to `undefined`, not `UNRESOLVED`, so without it `"a".concat(x.other)` computes
`"aundefined"`.

A branded `FoldedExpression` would give a compile-time floor, but it breaks the public signatures and
every hand-built-tree test. Fail loud now.

### F-FOLD-2 — fold bakes the host timezone into a wire-transmitted tree

`core/src/expressions/fold.ts:52` via `core/src/expressions/evaluate.ts:77`

```
([x, p]) => x.name === `${p.when}`   with { when: new Date(0) }

"value": "Wed Dec 31 1969 18:00:00 GMT-0600 (Central Standard Time)"
```

Reachable on the live `toExpression` path. `specs/filter-expressions.md` forbids this class under the
*environment* and *non-deterministic* refusal reasons. Before the fold change the shape threw inside
the translator, so a loud error became a silent frozen value.

Two guards:

1. `applyCall` honours the locale argument instead of ignoring it. An explicit locale is
   deterministic; the refusal is about the host locale. This also fixes row-time `evaluate`.
2. Fold refuses `to-string` and `concat` over non-primitive operands. The node survives,
   `canRender*` declines it, and the caller's own predicate answers in memory.

### F-FOLD-3 — `parseFragment` skips the fold

`core/src/expressions/parser.ts:2398`

Fold was wired into two of three parser exits. Because `canRenderInSql` now reports a call on a
literal as unrenderable, one unfolded constant in one conjunct makes `canPushDownJoin` return false
for the entire join.

```
parseFragment('o.age > 5 + 3')
  now:  canRenderInSql false → whole join pushdown abandoned
  was:  '"age" > ?' params [8]
```

Correct rows, lost pushdown. The fix goes inside the existing `try`, so a fold failure degrades to
`NOT_PARSABLE` instead of crashing `splitTupleFilter` mid-join.

All five producers of an `Expression` that reaches a translator were enumerated. This is the only
gap. F-FOLD-1 alone does not recover the pushdown, because `canRender*` does not compute values.

### F-FOLD-4 — a 48-case table that cannot fail

`core/src/expressions/fold.test.ts:145`

`expect(['value','call']).toContain(folded.type)` covers the only two reachable outcomes. The shared
`args: [ValueExpression('a')]` also makes every arithmetic row `UNRESOLVED`, so the intended fold
cases silently take the "stays a call" branch.

Replace with an explicit foldable table (21 calls), a surviving table (27 calls), and a completeness
check against `CALL_SOURCE`.

### F-FOLD-5 — a guard defending an unreachable state

`core/src/expressions/fold.ts:5`

`ParamReferenceExpression` is the only subclass of `ValueExpression`, and `bindExpression` replaces
every instance with a plain `ValueExpression` before fold runs. The documented `"undefineda"` failure
cannot occur on any path that calls fold.

Delete `isPlainValue` and use `isValueExpression`. `constructor ===` is also more fragile than a type
check when two copies of `@routier/core` are installed. Delete the fake-subclass `describe` block.

### The 14 failing tests

Two are real regressions and need no test edit — they pass once F-FOLD-1 lands.

| suite | test |
|---|---|
| `plugins/mongodb/src/mql.test.ts` | applies a value-side transformer to the literal |
| `plugins/sql-core/src/sql.test.ts` | applies a value transformer before binding |

Twelve used a constant on a literal as a probe for something else. Re-target each onto a property
operand, which preserves the original intent.

| suite | count | what it really tests | rewrite |
|---|---|---|---|
| `parser.test.ts` | 4 | a value-side call is attached, not dropped | literal `'TEST'`, assert the folded value |
| `parserParams.test.ts` | 5 | the `TRANSFORM_METHODS` table | point the probe at the property side |
| `parserSurvivors.test.ts` | 1 | the parser does not drop a value-side transform | assert the computed result |
| `arithmetic.test.ts` | 1 | precedence nesting | `x.age + x.other * 4` |
| `tokenizer.test.ts` | 1 | `/` is division, not a comment opener | `r.price / 2 === 5` |

### What the fold work already fixes

Nothing in phase 1 reverts it. `2 ** 3`, `6 & 4`, `1 << 3` and `null ?? "z"` on the value side all
threw before and now bind, because the plugin folders knew 5 calls and the evaluator knows 12.

## Phase 2 — make the capability report binding — DONE

### F-REPORT-1 — the result translator ignores `reason`

`core/src/plugins/translators/DataTranslator.ts:79`

`translate()` walks every option and never reads `reason`. The option is applied to returned rows over
an unfiltered set, then the memory pass applies it again.

| query | engine | expected | actual |
|---|---|---|---|
| `.where(price ** 2 > 400).map(p => p.name)` | sqlite | Bravo, Charlie | `[]` |
| `.where(price ** 2 > 400).countAsync()` | sqlite | 2 | throws |
| `.sumAsync` / `.minAsync` / `.maxAsync` | sqlite | value | throws |
| `.where(price >> 1 > 15).skip(1)` | mongo | C | `[]` |
| `.where(price >> 1 > 15).take(2)` | mongo | A, C | A |

Aggregate terminals are broken on every SQL plugin whenever a filter is reported: `SqlTranslator.count`
collapses the array to `data[0].count` for a statement that never contained the aggregate.

Fix: skip `target === "database" && reason !== "executed"`. Note `item.reason`, not
`item.option.reason` — `forEach` passes `enumeratedItems[i].option`.

No `functionMap` entry needs to run when the option did not: all ten have full `JsonTranslator`
implementations that the memory pass replays, and deserialization lives outside `translate`
(`decodeJsonColumns`, `schema.postprocess`).

### F-REPORT-2 — a join routes around the cascade

`core/src/plugins/query/QueryOptionsCollection.ts:186` · `core/src/plugins/query/join.ts:438`

The cascade is bounded by the collection instance, and every join path hands builders a
`splitAt("join").before` slice. The `join` item is in `at` and everything later in `after`; neither is
marked `not-reached`.

```
.where(p => p.price ** 2 > 400).join(s => s.tags, p => p.id, t => t.productId)
  control (p.price > 15):  ['Bravo','Charlie']
  actual:                  []
```

Fix: a derived collection delegates the report to its source, set in `splitAt` and `split` as
`origin = this.origin ?? this`, which keeps chains one deep. Then `joinInPlugin` returns the outer
rows when `at.reason !== "executed"`, which fixes MongoDB with no plugin change, and the SQL plugins
gate their join route on the same reason.

Extract the triplicated filter scan into sql-core as `reportUnrenderableFilters(options, dialect)`.

### F-REPORT-3 — a not-reached `map` narrows the SELECT list

`plugins/sqlite/src/utils.ts:319` · `plugins/postgres-core/src/utils.ts:426` · `plugins/mysql/src/utils.ts:381`

`mapFields` is collected before the capability scan and ignores `reason`, so the statement becomes
`SELECT "name"` while the reported filter needs `price`. Independent of F-REPORT-1: fix one and the
memory pass filters on a column the rows do not carry.

MySQL builds `columnsStr` directly from `mapFields` (`utils.ts:389`) rather than through
`mappedResultColumns`. Missing that leaves mysql broken while sqlite and postgres pass.

This also fixes `.where(unparsable).map(...)`, where a memory-target map narrows the SELECT today.

### F-REPORT-4 — two reports give an order-dependent answer

`core/src/plugins/query/QueryOptionsCollection.ts:261`

A later report re-runs the cascade and overwrites everything at a higher index with `not-reached`,
including an earlier `missing-capability` mark.

```
ascending:   filter:missing-capability  filter:missing-capability  take:not-reached
descending:  filter:missing-capability  filter:not-reached         take:not-reached
```

All four plugins loop every filter, so multiple marks are the normal case and the doc comment is the
wrong half. Marking a second unrenderable filter `not-reached` would be false: it was independently
inexpressible.

The invariant: **a report may name a culprit, never un-name one. Reports commute.**

## Phase 3 — stop the dialects lying — DONE

The missing invariant: **a claim must be proven by executing the rendered output against the engine,
across the full value domain the schema admits — not by rendering it.**

`test-utils/src/pluginContract.ts` now carries a "filter parity with JavaScript" section that
asserts the pushed-down rows equal `rows.filter(predicate)`, seeded with the values engines disagree
on: a fractional operand, a non-ASCII name, an integral REAL, a shift count over 32. A plugin that
pushes down must agree; one that hands the filter back passes trivially. So a wrong claim fails and
an unclaimed call cannot.

It runs against memory, sqlite, dexie, pouchdb, file-system, browser-storage and pglite. It caught
every fix below before the fix, and the two Postgres ones only under
`NODE_OPTIONS=--experimental-vm-modules`, which is how pglite's contract runs.

| finding | resolution |
|---|---|
| F-DIALECT-1 shifts | unclaimed on PostgreSQL and MySQL; renderer split out of the `bit-and` branch so the count is no longer cast |
| F-DIALECT-2 `matches` flags | `canRenderInMql` now reads the regex: `g`/`d` dropped and rendered, `y`/`u`/`v` not claimed |
| F-DIALECT-3 SQLite casing | the driver replaces `lower`/`upper` with JavaScript's; where it cannot, `engine-divergence` and a warning |
| F-DIALECT-4 SQLite `concat` | `SqlDialect` gained `name`, and the claim declines a numeric operand |
| F-DIALECT-5 MQL bitwise | unclaimed; renderer kept in `MQL_UNCLAIMED_ARITHMETIC` so claiming later stays a declaration change |
| F-DIALECT-6 PostgreSQL bitwise | `trunc((x)::numeric)::bigint` — `::numeric` first, because a bound parameter arrives untyped and `trunc(unknown)` is ambiguous |
| F-DIALECT-7 SQLite `bit-xor` | claimed; the `(a\|b)-(a&b)` identity is exact and truncates like JavaScript |

`engine-divergence` joined `DatabaseExecutionReason`, and `reportEngineDivergence` shares the
cascade with `reportMissingCapability`. Its explanation ends "Nothing in the query needs changing" —
the distinction a developer acts on.

The SQLite casing fix needed no SQL change: SQLite lets a connection replace a built-in, so
`lower()` itself becomes JavaScript's. `SqliteDriver.foldsUnicodeCasing` is required, so a new driver
cannot be written without answering the question.

### Found by review, fixed

| finding | what it was |
|---|---|
| the UDF was non-deterministic | `node:sqlite` defaults to it, and SQLite then refuses a schema that already has an index over `lower()` — **every statement fails, not just the filter**, on somebody else's database. Registered `{ deterministic: true }` |
| a throwing `defineFunction` leaked the connection | it ran between `open` and the `try`, so the `finally` that closes never ran |
| bitwise claims wrap | JavaScript runs ToInt32 and every engine here is 64-bit: `2147483648 \| 0` is -2147483648 in JavaScript. The whole family is unclaimed now, including the `bit-xor` claim this phase had just added |
| the concat guard missed one level | `` `${p.price + 0}!` `` still rendered `'5.0'` on SQLite. `readsANumber` walks the operand now |
| a join's inner side was never reported | an inner `.scope()` using `.toLowerCase()` goes into the `ON` clause, where nothing can report it afterwards. `canPushDownJoin` takes the diverging calls and refuses |
| the unclaimed shift renderers were untested | nothing pinned their output, so they would rot. `piece2.test.ts` renders both |

Still open here: MySQL, MSSQL and MongoDB claims are unverified — no server. Running the parity
section against them is the next thing. The harness also has no join case and no `matches` case.

## Phase 4 — JavaScript fidelity — DONE

All three predated the branch. Each is its own commit.

| finding | resolution |
|---|---|
| F-JS-1 strict equality coerced | the converter now runs only for a loose comparison; a strict type mismatch cuts to memory with `predicate-error` and warns |
| F-JS-2 `!==` dropped null rows | new `SqlDialect.isDistinctFrom` hook, wired into both the equals strategies and the generic path |
| F-JS-3 a window in front of a filter | a `filter` or `sort` added after a `skip`/`take` cuts to memory with `after-window` |

### What the converter turned out to be

`resolvePairedValue` rewrote the literal to the column's schema type regardless of `operator.strict`,
so the tree recorded `strict` and then discarded it. It is a fossil of the pre-tokenizer parser,
where every literal arrived as source text. Its only remaining legitimate job is loose and relational
coercion, and that is all it does now.

Detection lives in `QueryOptionsCollection.add`, beside the unmapped- and renamed-property checks,
so no parser change was needed beyond letting the mismatch survive into the tree.

### `isDistinctFrom` per dialect

| dialect | rendering |
|---|---|
| sqlite | `left IS NOT right` |
| postgresql | `left IS DISTINCT FROM right` |
| mysql | `NOT (left <=> right)` |
| mssql | `CASE WHEN EXISTS (SELECT left INTERSECT SELECT right) THEN 0 ELSE 1 END = 1` |

Thunked, because MSSQL's form names each operand once and the others name them twice — a
non-thunked signature would shift the placeholders.

Emitted unconditionally for a negated equals. Nullability narrowing is unnecessary: `!=` was never
sargable, so the rewrite costs nothing.

### Found by review, fixed

| finding | what it was |
|---|---|
| swapped parameters | the equals strategies rendered the column before running, but `equalsValueColumnRight` emits the value first, so `5 === x.a + 1` bound `[1, 5]` for `? = ("a" + ?)`. `col` is a thunk now, bound in emission order. Pre-existing on sqlite and mysql; Postgres and MSSQL were immune because their placeholders self-number |
| a warning that killed the query | `JSON.stringify` throws on a BigInt, inside the guard whose whole job is catching one. `x.age === 5n` threw out of `.where()` |
| Date columns still diverged | `JAVASCRIPT_TYPE_OF` omitted `Date`, and with the converter gone the raw string reached SQL. A Date column compared to its own ISO string returned a row where JavaScript returns none |
| the message was wrong for `!==` | the detection ignores `negated`, correctly — but both the warning and the explain text said "returns nothing", when a negated mismatch matches every row |

### Not yet written

Both warnings link to routier.dev pages that do not exist: `/guides/strict-comparison-types` and
`/guides/sqlite-case-folding`.

### The warning is silent by default

`logger`'s default level is `silent` unless `NODE_ENV` is `dev`/`development`, or `ROUTIER_LOG_LEVEL`
or `DEBUG=routier` is set. The `predicate-error` contract says "the caller should fix it", and a
plain `node app.js` tells them nothing. `.explain()` still names it. Worth a decision.

### A latent trap in the ratchet

`split()` and `splitAt()` copy items through `adopt`, which bypasses `add`, and they do not carry
`nextExecutionTarget`. So a half that adopted a `take` and then has a `filter` added trips
`after-window`. The live call site — `join.ts:376`, `innerOptions.split().database` then
`.add("filter", ...)` — is safe only because inner options carry filters and never a window. It
becomes real for whoever adds inner windowing.

### Still open, deliberately

The rest of the three-valued family is NOT fixed, and each needs a `COALESCE` decision that changes
index behaviour:

- `x.n <= 3` with `n` null — JavaScript coerces null to 0 and keeps the row; SQL drops it
- `!(x.n > 3)` — the negated relational renders `<=`
- `!x.other?.includes("b")` — `NOT GLOB` on null
- `x.n === x.n` over two nulls — renders `"n" = "n"`

The subquery-per-window-boundary alternative to F-JS-3 stays deferred: it keeps full pushdown but is
three parallel builder rewrites, leaves MongoDB broken, and optimises a chain shape nothing in the
repo uses. `skip(N)`-then-filter is the one shape where it would pay.

## Phase 5 — the explain surface — DONE

| finding | resolution |
|---|---|
| `describeValue` covered three of six tags | the parameter is typed `SerializedValue`, so the `in`-guards narrow the union and the fallthrough only type-checks as `{ number }` |
| the unsupported branch read `expression.t` | `.type` — Piece 1 renamed it and this branch always printed `undefined` |
| `matches` rendered receiver and pattern swapped | a new `regex-test` form in `CallSource`, so `/^Al/.test(name)` reads the way it was written |
| a phantom `{ undefined: true }` argument on four unary calls | one frozen `NO_ARGUMENT` sentinel, compared by identity in `createOperandExpression` |
| `concat` and `to-string` sat below the null guard | hoisted; `String(null)` is what a template produces, so both are total |
| a refused method lost its reason | `NotParsableExpression` carries an optional `reason`, serialized and restored, printed by both explain renderers |

### The seventh tag is now a compile error

Verified by adding one: `formatExplanation.ts` fails to compile at the fallthrough. That is the
invariant the fix was for — not the two missing branches.

### 35 assertions stopped comparing against a sentinel

`toStrictEqual(Expression.NOT_PARSABLE)` broke the moment a refusal carried a reason. A refusal is
"did it refuse", not "is it this exact object", so they assert `type` now.

## Phase 6 — spec and coverage reconciliation — DONE

### `specs/filter-expressions.md`

| edit | why |
|---|---|
| the whole bitwise family marked "rendered, not claimed" | phase 3 unclaimed it; the table still showed ✅ |
| the 32-bit section rewritten | it covered `& \| ^ ~` and omitted the shifts, and its "claiming bitwise only for integral columns would close it" is now moot |
| `concat` on SQLite qualified | declines a numeric operand |
| five rows added | casing, `trim`/`absolute`/`round`, `floor`/`ceiling` — claimed by the code, absent from the table |
| *"Otherwise SQLite, PostgreSQL, MongoDB and every in-process plugin agree with JavaScript"* deleted | it was false in four documented ways |
| strict equality, three-valued logic and truthy shorthand documented | phase 4 fixed the first two halves and left the rest, which the spec never named |
| the partial-interpolation refusal removed | it parses now — Piece 2 gave each `${…}` its own stream |
| `(x.age + 1) * 2 > 5` added to *Still open* | refused, and in neither list |
| the "54 assertions and 49 todos" line deleted | it duplicated what Jest already reports, and was wrong |

Every claim written was checked against the real parser before it went in, including the two that
say a form parses.

### `core/src/expressions/coverage.test.ts`

Four `it.todo`s asked for shapes the spec refuses: an async predicate and `localeCompare` are
deleted, and the two local Date getters became their UTC forms, which the spec marks **call**.

A `describe('refused: the spec says these must never parse')` block asserts eight refusals, each
citing its reason. They are written as **source strings**: TypeScript rejects `x.age & 6 === 2` for
the very reason the spec refuses it, and a bundler strips the brackets that make the others what
they are.

Verified the block discriminates by pointing one case at a parsable source and watching it fail.

### Found by review, fixed

**A method table was keyed by source text and had `Object.prototype` on its chain.**
`TRANSFORM_METHODS["toLocaleString"]` returned `Object.prototype.toLocaleString` — truthy — so the
parser read an unsupported method as a supported one and **silently erased the call**:

```
x.name.toLocaleString() === "a"   parsed as   name === "a"
```

`toString`, `valueOf`, `constructor` and `hasOwnProperty` did the same, on strings, numbers, dates and
arrays. `(1234.5).toLocaleString()` is `"1,234.5"`, so the pushdown compared the raw column — exactly
what the *environment* refusal exists to prevent. Every source-keyed table in the parser is
null-prototype now, which removes the class rather than the four call sites.

Also: two refusal cases cited `precedence`, which is not one of the five reasons, in a tuple element
nothing read. The reason is asserted against the five now. Three "Still open" forms gained the todo
they lacked, and `x => false` is a gap in both places rather than a refusal in one.

## Found by the books app

`e2e/src/books/` keeps a double-entry book end to end — chart of accounts, customers, vendors,
items, invoices with lines, payments, bills, journal postings, void and reversal — and asserts P&L,
balance sheet, AR aging and customer statements against hand-computed answers on every engine. The
trial balance is the invariant: debits minus credits is zero, and a query that loses a row breaks it.

It found three defects the whole suite had no coverage for. **There was no date-filter test anywhere
in the repository**, and the spec's *Supported today* table lists `Date` params as working.

### A date param matched nothing on every in-memory plugin — FIXED

`EphemeralDataPlugin` holds a `s.date()` as an ISO string and ran the caller's predicate against the
raw record, so `"2026-01-05T12:00:00.000Z" >= aDate` compared a string to a stringified Date
lexicographically and was false for every row.

```
r.at >= p.from   (Date param)     ->  []      wrong
r.n  >= p.min    (number param)   ->  [6, 7]  fine
```

Both filter passes had to be fixed, and they are not symmetric. The plugin's leading-filter pass
converts the row it tests but still returns the stored one, because change tracking, versioning and
renames all read storage shape — returning the converted row broke optimistic concurrency,
cross-collection atomicity and every renamed-property test. `JsonTranslator` takes a `storageShape`
flag instead of guessing, because the same translator runs over storage-shape rows inside a plugin
and entity-shape rows in the datastore's memory pass.

Affects the memory, file-system and browser-storage plugins.

### A date param could not be bound on SQLite — FIXED

`bindableFor` converted booleans and nothing else, so a `Date` reached the driver raw:
`Provided value cannot be bound to SQLite parameter 1`. It now routes a `Date` through the
dialect's `encodeDate`, and the pass-through encoder converts to ISO — the form the column holds.
MySQL already had its own encoder and is unchanged.

### A nested property could not be projected on SQL — FIXED

`.map(c => c.billing.region)` rendered `SELECT "billing.region"` and the column does not exist.
Filtering worked, because `renderColumn` uses the dialect's `jsonPathExpression`; the SELECT list
quoted the field name verbatim instead.

Two halves, and the second is easy to miss. `selectList` in sql-core reads a nested value out of its
JSON column and aliases it back to the name the result shape expects, and all three SQL plugins use
it. SQLite also needed `columnList`: a paging query wraps the statement, and the outer SELECT has to
read the alias rather than re-render the path, because the JSON column is not in scope there.

The row then arrives FLAT, keyed by the alias, so `SqlTranslator.map` lifts it back onto the
property's path before the selector runs. A `ResultColumn` can also describe something with no
schema property behind it — a concurrency token, an aggregate — so the helper checks before
treating one as a property.

## The regression net

Twenty-two defects behind a green suite is a fixture problem. Three structural guards, in order of
value.

1. **A parity harness in `test-utils/src/pluginContract.ts`** asserting the pushed-down result equals
   `rows.filter(predicate)` in plain JavaScript. The right-hand side cannot be wrong about
   JavaScript. A plugin that pushes down must agree; one that falls back passes trivially. So a wrong
   claim fails and an unclaimed call cannot. Every future divergence is one more row.
2. **Seed divergent values.** Cases bring their own `5.5`, `Écho`, integral REAL, wide shift count and
   astral character. The existing fixture is the blind spot.
3. **Make refusals executable**, as above.

Two operational traps:

- The mongodb plugin's own suite runs against `FakeMongoDriver`, which agrees with whatever the plugin
  believes. Mongo claims can only be proven in `e2e/src/mongoContainer.test.ts` behind
  `E2E_CONTAINERS=1`, the way `mysqlContainer.test.ts` already does.
- A known divergence belongs in `knownFailing`, visible as `it.failing`. Never `skipSections`.

## Follow-ups

| item | why it is deferred |
|---|---|
| Tier 3 proper — a `KNOWN_CALLS` method grammar | large; a new method then costs one union member, one `CALL_SOURCE` entry and one row |
| unify the two explain renderers | one walks a live tree and extracts parameters, the other walks a serialized tree and prints inline |
| subquery pushdown for `skip(N)`-then-filter | the one chain where the memory ratchet costs real work |
| the relational-on-null family | needs a `COALESCE` decision and an index-behaviour call |
| MySQL bitwise | unverifiable without a container |
| MSSQL `moduloExpression` casts one side | no MSSQL plugin ships |
| the value-side locale plumbing is now unobservable | see below |
| inner-side reports persist across dispatches | see below |

### Inner-side reports are never forgotten

A report on a join's inner scope lands on `join.value.innerOptions`, and `forgetReports()` never
walks nested collections, so it survives into the next dispatch on the same queryable.

Harmless today: `buildJoinStatement`, `canPushDownJoin` and `executeJoin` all ignore `reason` on the
inner side, and `split()` already shared those item objects before this work. It becomes real the
moment anything on the inner side starts honouring `reason`, which phase 3 brings closer.

### The value-side locale plumbing is dead

`parser.ts:1779` decides whether to attach a locale argument to a **value-side** casing call, and
`:1820` sets it. Neither is observable any more: a casing call over literals is always folded, so the
argument is consumed before any caller sees the tree, and the parser only ever emits `en-US`, which
has no casing tailorings.

Two mutants therefore survive with no test able to kill them through the public parse API. The
resolution is to delete the value-side locale plumbing rather than to write a test for a value that
cannot differ. The property side keeps its locale and keeps its coverage.

Related and separate: `parser.ts:767` hardcodes `locale: "en-US"` for `toLocaleLowerCase`, but
JavaScript with no argument uses the **host** locale. On a `tr-TR` host `'TITLE'.toLocaleLowerCase()`
is `'tıtle'` and the tree says `'title'`. That is a `predicate-error` or `engine-divergence`
candidate, and it predates this work.
