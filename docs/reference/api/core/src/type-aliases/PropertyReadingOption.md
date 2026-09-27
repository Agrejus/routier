[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / PropertyReadingOption

# Type Alias: PropertyReadingOption

> **PropertyReadingOption** = `"filter"` \| `"sort"` \| `"nearest"` \| `"map"` \| `"group"`

Defined in: [core/src/plugins/query/renames.ts:15](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/renames.ts#L15)

The options that name a property by what the caller wrote, and so can name a renamed one.

`sum`, `min`, `max` and `distinct` are not among them: they carry no property, and read what the
`map` in front of them projected. A report on that `map` ends the database phase, so they run in
memory behind it.
