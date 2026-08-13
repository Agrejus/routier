[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / DEFAULT\_SEMI\_JOIN\_KEY\_THRESHOLD

# Variable: DEFAULT\_SEMI\_JOIN\_KEY\_THRESHOLD

> `const` **DEFAULT\_SEMI\_JOIN\_KEY\_THRESHOLD**: `500` = `500`

Defined in: [core/src/plugins/query/join.ts:238](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/join.ts#L238)

How many distinct outer keys are still worth turning into an `IN (...)` prefilter.

A cost decision, never a correctness one: above the threshold the inner side is read under its
own scopes and the hash join discards the surplus, which is the same answer by a slower route.
500 because a bound-parameter list is cheap in the hundreds and starts costing more than the
scan it saves in the thousands — and some engines refuse a list that long outright.
