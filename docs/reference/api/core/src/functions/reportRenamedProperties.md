[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / reportRenamedProperties

# Function: reportRenamedProperties()

> **reportRenamedProperties**(`options`, `names`): `void`

Defined in: [core/src/plugins/query/renames.ts:95](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/renames.ts#L95)

Hands back every option over a property stored under a `.from()` name, for the datastore to run
in memory.

Core keeps such an option with the database, because only the plugin knows whether its backend
reads storage names. One that translates the option — SQL renders the column from
`getResolvedName()` — needs nothing from here. One that runs the caller's lambda over rows as it
stores them reads a key the row does not have, and answers wrongly without an error: that plugin
calls this before it reads anything, and the datastore finishes the query after deserialization,
where the in-memory names exist.

Reported as `missing-capability`: the backend cannot express the option as written, and like
every capability, that is only knowable by the plugin.

## Parameters

### options

[`QueryOptionsCollection`](../classes/QueryOptionsCollection.md)\<`any`\>

### names

readonly [`PropertyReadingOption`](../type-aliases/PropertyReadingOption.md)[] = `PROPERTY_READING_OPTIONS`

Which options to check, for a plugin that resolves some of them itself — Mongo renders
filters and sorts through the stored path, and runs `nearest`, `map` and `group` in JavaScript.

## Returns

`void`
