# Surviving-mutant backlog

Generated from `npm run mutate:expressions`, first full run. **Updated 2026-08-03** — see
"2026-08-03 session" below; the numbers in the historical sections describe the earlier
runs they belonged to.

## Result

| Area | Score | Gate | Status |
| --- | --- | --- | --- |
| `core/src/expressions` | **74.01%** | ≥ 90% | Failing (exit 1) |

## 2026-08-03 session: 74.01 → ~90, and the equivalence decision

Two things moved the number, in order of honesty:

1. **The 74.01% was stale.** `sql.ts` was moved to `@routier/sql-plugin-core` after the
   last run, taking its mutants (63 survivors) out of this area's denominator. The fresh
   baseline with no new tests was **78.39%** (1,055 mutants).
2. **Direct tests** took it to **82.65%**: `forEach` traversal semantics (utils.ts to
   94.7%), the `EXPRESSION_TYPES` whitelist behind `isExpression` (constants.ts to 100%),
   the `Expression` sentinel statics (all 15 no-coverage types.ts mutants; types.ts to
   100%), `parserCoverageGaps.test.ts` (the parser's 29 no-coverage paths), and
   `parserSurvivors.test.ts` (failure-message content for every newly covered rejection
   site, string escapes, keyword literals, converters on bound params, method-call boolean
   folding, the truthy shorthand).

**The equivalence decision** (per "Open work" item 3 and the analysis below): the gate
stays at 90 and the experimentally-established equivalent clusters are excluded with
inline `// Stryker disable` comments carrying written justifications — visible in the
source, auditable in the diff, never a config-side list. Excluded:

- `SINGLE_CHARACTER_PUNCTUATION` (the line-45 cluster, 11 mutants) — the experiment below
  established equivalence: rejection messages name the character from the source, not the
  set.
- The four-conjunct bracket-access guard and the `TRANSFORM_METHODS` guard (the 621/666
  clusters) — every mutation reroutes between two paths that both collapse to
  NOT_PARSABLE; 30 targeted tests killed one.
- The template-cache cap — a pure resource bound; every mutation parses identically.
- Three `converters` entries (Computed/Definition/Function) — those types cannot appear
  in a parsable filter (computed/function filters route to in-memory execution).

Measured after annotations + tests: **89.83%** on 993 mutants; the last two kills came
from the `forEach` right-link failure propagation and four remaining uncovered parser
paths (consumed-past-the-end, lone-value condition, out-of-scope variable, membership
`.includes()` binding).

1,416 mutants over 6 files, 166 tests, ~8 minutes. The gate fired correctly, which is the
point: line coverage on `expressions` was already high, and mutation testing says roughly
four in ten deliberate defects there would ship unnoticed.

### Choosing each area's test set

Three configurations were measured, and the result is not intuitive:

| Test set | Tests | Survived | No coverage | Score | Runtime |
| --- | --- | --- | --- | --- | --- |
| All core + datastore | 469 | 323 | 206 | 62.64% | ~19 min |
| `core/src/expressions` only | 111 | 309 | 228 | 62.08% | ~2.5 min |
| expressions + datastore | 166 | 309 | 199 | **62.99%** | ~8 min |

Narrowing is not free. Scoping to `core/src/expressions` alone moved 22 mutants to
"no coverage", which counts against the score exactly like a survivor — the parser is
reached end-to-end through datastore queryables, and those suites kill mutants no
expressions-local test covers. An area's globs must include every suite that exercises the
mutated code, not just the suite sitting next to it. Getting this wrong makes a run both
faster and less truthful.

## Survivors by file

| File | Survivors |
| --- | --- |
| `parser.ts` | 241 |
| `sql.ts` | 63 |
| `utils.ts` | 11 |
| `constants.ts` | 7 |
| `types.ts` | 1 |

## Survivors by mutator

| Mutator | Count | Reading |
| --- | --- | --- |
| ConditionalExpression | 138 | Branch conditions no test discriminates. Highest value. |
| StringLiteral | 87 | Mostly `ERROR_MESSAGES` text. See "Error message text" below. |
| LogicalOperator | 36 | `&&`/`||` swaps in guards. |
| BlockStatement | 15 | Whole blocks removable with no test noticing. |
| EqualityOperator | 14 | `===`/`!==` swaps. |
| BooleanLiteral | 10 | |
| ArrowFunction, ObjectLiteral, MethodExpression, other | 23 | |

## Progress

| Round | Score | What changed |
| --- | --- | --- |
| Baseline | 62.99% | — |
| + `parser.mutants.test.ts` (12 tests) | 63.28% | Null coercion, tokenizer whitespace |
| + `filterForms.test.ts` (50 tests) | *(included above)* | Behavioral filter battery — low yield, see below |
| + `parserRejection.test.ts` (31 tests) | 67.02% | The 33 untested `throw` sites |
| + `sqlDialects.test.ts` (65 tests) | 68.50% | 4 dialects x quoting / placeholders / LIKE vs GLOB |
| + `parserMessages.test.ts` (18 tests) | 70.41% | Failure-message content, via a logger spy |
| + `tokenizer.test.ts` (50 tests) | 73.66% | Block comments, operator table, string/template literals |
| + `parserParams.test.ts` (18 tests) | **73.94%** | Param-driven property access, transform-method table |

### Yield per test, measured

| File | Tests | Points gained | Points per 10 tests |
| --- | --- | --- | --- |
| `parserMessages.test.ts` | 18 | +1.91 | **1.06** |
| `parserRejection.test.ts` | 31 | +3.74 | **1.21** |
| `tokenizer.test.ts` | 50 | +3.25 | **0.65** |
| `parserParams.test.ts` | 18 | +0.28 | 0.16 |
| `sqlDialects.test.ts` | 65 | +1.48 | 0.23 |
| `filterForms.test.ts` | 50 | +0.29 | 0.06 |

Direct assertions against the unit under test outperform end-to-end behavioral tests by
roughly ten to twenty times here. The two winners both assert something no behavioral test can
observe: that a refusal happens at all, and what it says.

### Why the behavioral battery under-delivered

`filterForms.test.ts` runs 50 filter forms through a real query and compares to
`Array.prototype.filter`. It is a good test of the query path, but a **weak oracle for
parser mutants**: when the parser returns NOT_PARSABLE the datastore silently falls back to
in-memory filtering, so the rows come back correct either way. A mutant that breaks parsing
is invisible to it.

Direct `toExpression` assertions are the right tool for this area. The rejection battery,
one third the size, moved the score more than three times as far.

## Closed so far

`core/src/expressions/parser.mutants.test.ts` targets two concrete groups:

1. **Null coercion** — `Number: v => v == null ? v : Number(v)` and its String/Boolean
   siblings. The null guard was untested, so `price === null` would have parsed as
   `price === 0`, `name === null` as `name === "null"`, and `active === null` as
   `active === false`. Each matches the wrong rows rather than erroring.
2. **Tokenizer whitespace** — every existing filter is written with plain spaces, so the
   `\t`, `\r`, and `\n` branches of the whitespace test were never exercised. A formatter
   emitting tabs would have broken parsing with nothing to catch it.

## Analysis: the resistant clusters are equivalent mutants

An experiment settled this rather than leaving it to judgement.

**Hypothesis.** The three resistant clusters looked killable. `parser.ts:45` is
`SINGLE_CHARACTER_PUNCTUATION`; its twelve survivors each delete one entry
(`{ } ; % * / + = ? : & | ,`). Every one of those characters appears only in syntax the
parser rejects, and `toExpression` collapses all rejections to NOT_PARSABLE — so behavior
cannot separate them. But the rejection message names the token ("unexpected token '%'"), so
a character dropped from the set should not be able to name itself. Asserting the message
ought to kill the cluster. The same reasoning applied to `parser.ts:621`, whose four-conjunct
guard routes bracket access to either the param branch or an unsupported-access throw — again
two different messages behind one NOT_PARSABLE.

**Result: falsified.** 30 tests written precisely against that theory killed **one** mutant
of twelve at line 45, and none at 621/666. Score moved 73.94% -> 74.01%.

**Conclusion.** Eleven of the twelve at line 45 are equivalent: removing a character from the
punctuation set does not change the message, so no assertion at any observable boundary can
distinguish the mutant from the original. Per the strategy, these should be recorded as
equivalent and excluded from the score rather than chased.

The tests were kept regardless. "A rejection names the character it choked on" is worth
asserting on its own merits — it is the difference between a usable diagnostic and
"unsupported expression format".

**What this means for the 90% gate.** With ~11 known-equivalent mutants at one line alone,
and 93 singleton survivors spread one-per-line, part of the remaining 16 points is
unreachable by testing. Before more test-writing, someone should audit a sample of survivors
for equivalence and decide whether 90% is the right number for this file or whether the gate
should be set against a survivor budget that excludes documented equivalents.

## Earlier note: diminishing returns

`parserParams.test.ts` aimed 18 direct tests at two clusters totalling 17 mutants
(`parser.ts:621` param-driven property access, `parser.ts:666` the transform-method table)
and killed **one**. Both clusters are unchanged in the next run, as is `parser.ts:45`.

That is the signal to stop adding tests and start reading mutants. Three explanations, and
the next session should establish which applies before writing anything:

1. **Equivalent mutants.** A mutant whose behavior is indistinguishable from the original
   cannot be killed by any test. `parser.ts:45` is `MULTI_CHARACTER_PUNCTUATION`, a
   module-level constant; blanking one entry may leave the tokenizer producing the same
   tokens by a different route. The strategy calls for documenting these rather than
   chasing them.
2. **Static mutants.** 537 of 1,416 (38%) are static — evaluated once at module load.
   Attribution under `perTest` coverage is weaker for these.
3. **Genuinely uncovered branches** the tests missed despite aiming at the right lines.

93 of the remaining 245 survivors are singletons — one per source line. Even if every one
were killable, that is one test per mutant with no leverage left.

## Open work, in priority order

1. **`parser.ts` ConditionalExpression survivors.** The bulk of the gap and the
   highest value: each is a branch the parser takes on some input no test supplies. Best
   attacked with generated input rather than hand-written cases — the fast-check corpus in
   `plugins/memory/src/tests/queryProperties.test.ts` is the natural place to widen, since
   it already builds real arrow-function source.
2. **`sql.ts` (63).** No differential test exists for SQL generation. The query oracle
   covers plugin *results*; nothing compares generated SQL against an expectation.
3. **Error message text (87 StringLiteral).** A decision, not a defect: either assert
   message content where it is part of the contract (`NOT_PARSABLE` reasons that callers
   branch on), or accept that message wording is not behavior and exclude
   `ERROR_MESSAGES` from the mutation set. Do not silently exclude it to move the number —
   the gate is only worth having if it measures something real.

## Notes for the next run

- 123 static mutants (9% of total) consume ~62% of runtime. `ignoreStatic: true` would cut
  the run substantially, at the cost of not testing module-load-time code.
- The run executes all 469 core + datastore tests. Narrowing `testMatch` per area would
  speed it up, but `perTest` coverage already attributes correctly, so this is a runtime
  concern rather than a correctness one.

---

# Area: `plugins/replication` — 2026-08-04

New area. Config: `stryker/replication.mjs` (+ `stryker/jest.replication.js`,
`stryker/replication.setup.js`), script `npm run mutate:replication`, gate 80.

Runtime is the binding constraint here, so the setup file caps the chaos suite at 3 seeds
(`CHAOS_SEEDS=3`) and silences the plugin logger for mutant runs. Budget ~3 minutes per 100
mutants at ~15 tests/mutant. Run per file, not per package.

## Result

| Scope | Mutants | Before | After | Notes |
| --- | --- | --- | --- | --- |
| `httpUtils.ts` | 104 | 85.05% | **99.01%** | 1 survivor, equivalent-only |
| `UnsyncedQueue.ts` | 269 | 63.68% | **83.96%** | 30 survivors, 4 no-coverage |
| `auth.ts` | 35 | 27.78% | **88.89%** | 2 survivors, both the documented redundancy |
| `HttpSwrDbPlugin.ts`, `HttpDbPlugin.ts`, `PluginSyncEngine.ts`, `OptimisticUpdatesDbPlugin.ts` | — | — | not yet run | `HttpSwrDbPlugin.ts` alone is ~1 200 lines |

The gains came from tests, not exclusions: `KeyedMutex` behavior (mutual exclusion, arrival
order, key cleanup, lock release on failure), Retry-After parsing edges, the status
predicates, jitter *spread* rather than just its bounds, `UnsyncedQueue`'s failure paths (store
query fails, store persist fails, unparseable `entityJson`, legacy rows, single-row and null
store responses, empty-work short-circuits), coalescing order under both row orders, and
`buildAuthErrorEvent` in full.

**Mutation testing found a real bug** while doing it: `readRetryAfterMs` sent a negative
`Retry-After` through `Date.parse`, which accepts `"-5"` as a year, so a malformed header meant
"retry immediately" instead of "use the computed backoff".

## Remaining survivors, classified

Of the 32 in `UnsyncedQueue.ts` + `auth.ts`:

- **18 log-message and log-payload mutants** (`logger.warn("")`, `logger.debug(..., {})` at
  lines 244, 258, 343, 389, 449, 506, plus the `source`/`action` strings on the store events
  the queue builds). Unobservable through any boundary the queue exposes. **Decision: recorded
  here, not annotated inline.** Eighteen `// Stryker disable` comments through the durability
  core would cost more readability than the annotations buy, and the class is uniform enough to
  describe once. This is the same call the expressions area faced with its 87 `ERROR_MESSAGES`
  StringLiteral survivors.
- **~8 equivalent guards.** `if (changes.length === 0) return` (lines 183, 403) — `persistToStore`
  has its own empty guard, so the outer one only saves work; `confirmedSeq == null` / `<=` vs `<`
  (254, 257) — seq is unique per change, so the boundary case cannot occur; `if (c.seq != null)`
  (230) — the mutant produces `NaN`, which fails every comparison, reaching the same outcome;
  `Math.max` → `Math.min` (231) — only differs when one call confirms several changes for one
  entity, and the mutant retires *less*, which is safe by construction; `newest == null` (146) and
  `group[0]?.recordIds` (343) — groups are built by pushing and are never empty.
- **4 store-tolerance mutants.** `removeRowIds: ["Stryker was here"]` (199, 236, 382, 408) and
  `collectionName: "Stryker was here!"` (395, 406). Removing a row id that does not exist is a
  no-op in `MemoryPlugin`, and `collectionName` on a remove is cosmetic — the row id is the key.
  A store that errored on unknown ids would kill these.
- **2 in `auth.ts`**, annotated inline: the `instanceof HttpStatusError` branch is deliberately
  redundant with the message fallback below it, which parses the same status out of the same
  message. No test can separate them.

## Open work

1. **Run the four remaining files.** This is where the interesting logic lives — the SWR
   read/write paths, retry loops and the composition engine. Expect it to take hours; run one
   file at a time and add a row to the table above for each.
2. **Then tighten the gate.** 80 was picked before any score existed. Once the package has a
   number, set `break` just under it, the way expressions sits at 90.
3. **The 74 "errors" in `UnsyncedQueue.ts`** are mutants that break the schema definition at
   module load, so they never reach a test. They are excluded from the score denominator, which
   is correct, but worth confirming none of them hides a real gap.
