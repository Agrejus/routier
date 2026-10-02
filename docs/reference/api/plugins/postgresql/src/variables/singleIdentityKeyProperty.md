[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / singleIdentityKeyProperty

# Variable: singleIdentityKeyProperty()

> `const` **singleIdentityKeyProperty**: \<`T`\>(`schema`) => `PropertyInfo`\<`T`\> \| `null`

Defined in: plugins/postgres-core/dist/utils.d.ts:62

The one identity key that gets special column treatment, or `null`.

A schema with a single identity id property maps it to `SERIAL` (number) or `UUID` (string);
anything else — a composite key, a caller-supplied key — is an ordinary column. Extracted so the
DDL and `postgresJoinKeyCast` cannot disagree about which columns are `uuid`, which they would
eventually do if each restated the rule.

## Type Parameters

### T

`T` *extends* `object`

## Parameters

### schema

`CompiledSchema`\<`T`\>

## Returns

`PropertyInfo`\<`T`\> \| `null`
