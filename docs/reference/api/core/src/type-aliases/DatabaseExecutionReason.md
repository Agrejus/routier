[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / DatabaseExecutionReason

# Type Alias: DatabaseExecutionReason

> **DatabaseExecutionReason** = `"executed"` \| `"missing-capability"` \| `"engine-divergence"` \| `"not-reached"`

Defined in: [core/src/plugins/query/types.ts:69](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L69)

What became of an option planned for the database.

`missing-capability` and `engine-divergence` are the only values a plugin writes, and the only
ones core cannot derive: an engine's capabilities are not knowable from here. SQLite's `REGEXP`
exists if the host registered the function and not otherwise, so two instances in one process can
differ.

They are separate because a developer can act on one and not the other: no way to say it at all,
versus an engine that would answer, and answer differently from JavaScript.

`not-reached` is the rest of the database phase after either. The database stops there rather than
carrying on: a window applied in front of a filter that was not applied returns the wrong rows.
Core writes it, so a plugin cannot mark a cascade it does not own.
