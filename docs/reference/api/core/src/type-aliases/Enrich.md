[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / Enrich

# Type Alias: Enrich()\<TEntity\>

> **Enrich**\<`TEntity`\> = \{(`entity`, `changeTrackingType`): [`InferType`](InferType.md)\<`TEntity`\>; (`entity`, `changeTrackingType`): [`InferCreateType`](InferCreateType.md)\<`TEntity`\>; \}

Defined in: [core/src/schema/types.ts:176](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L176)

## Type Parameters

### TEntity

`TEntity` *extends* `object`

## Call Signature

> (`entity`, `changeTrackingType`): [`InferType`](InferType.md)\<`TEntity`\>

### Parameters

#### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### changeTrackingType

[`ChangeTrackingType`](ChangeTrackingType.md)

### Returns

[`InferType`](InferType.md)\<`TEntity`\>

## Call Signature

> (`entity`, `changeTrackingType`): [`InferCreateType`](InferCreateType.md)\<`TEntity`\>

### Parameters

#### entity

[`InferCreateType`](InferCreateType.md)\<`TEntity`\>

#### changeTrackingType

[`ChangeTrackingType`](ChangeTrackingType.md)

### Returns

[`InferCreateType`](InferCreateType.md)\<`TEntity`\>
