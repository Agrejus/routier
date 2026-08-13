[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / JoinInnerSideResult

# Type Alias: JoinInnerSideResult

> **JoinInnerSideResult** = \{ `ok`: `"success"`; `innerSide?`: [`JoinInnerSide`](JoinInnerSide.md); \} \| \{ `ok`: `"error"`; `error`: `unknown`; \}

Defined in: [core/src/plugins/query/join.ts:47](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/join.ts#L47)

`undefined` when the query has no join at all, which is the common case and not an error.
