[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/mongodb/src](../README.md) / toMql

# Function: toMql()

> **toMql**(`expr`): [`MqlFilter`](../type-aliases/MqlFilter.md)

Defined in: [plugins/mongodb/src/mql.ts:349](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/mongodb/src/mql.ts#L349)

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
