[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/mongodb/src](../README.md) / toMql

# Function: toMql()

> **toMql**(`expr`): [`MqlFilter`](../type-aliases/MqlFilter.md)

Defined in: [plugins/mongodb/src/mql.ts:349](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/mql.ts#L349)

Converts an Expression to a MongoDB filter document.

A note on null, because Mongo draws a distinction the SQL engines do not. `{ f: null }`
matches documents where `f` is null AND documents where `f` is absent, whereas
`col IS NULL` has no absent case — a column always exists. The two agree for documents
Routier wrote, since a schema serialises a nullable property as an explicit null rather
than omitting it. They diverge over documents written by something else, and this
translator deliberately takes the Mongo-native reading rather than adding a `$type`
check that would make Routier's own rows behave differently from every other backend.

## Parameters

### expr

`Expression`

## Returns

[`MqlFilter`](../type-aliases/MqlFilter.md)
