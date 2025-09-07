# Create Operations

Create operations in Routier allow you to add new entities to your collections. The framework provides both synchronous and asynchronous methods, with automatic change tracking and validation.

## Overview

When you create entities in Routier:

1. **Entities are validated** against your schema
2. **Default values are applied** automatically
3. **Identity fields are generated** if specified
4. **Changes are tracked** for later persistence
5. **Entities are returned** with all properties set

## ⚠️ Important: Persistence Requires Save

**Note: When you call `addAsync()`, the entity is added to the collection in memory, but it is NOT automatically persisted to the database. You must call `saveChanges()` or `saveChangesAsync()` to persist the changes.**

## Basic Create Operations

### Adding Single Entities




{% capture snippet_vvzyz2 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_vvzyz2 | escape }}
```



### Adding Multiple Entities




{% capture snippet_gsb9ng %}{% include code/%}{% endcapture %}

```ts
{{ snippet_gsb9ng | escape }}
```



### Adding with Callbacks

**Note: Callback-based operations use a discriminated union result pattern. The callback receives a single `result` parameter that can be either `{ ok: "success", data: T }` or `{ ok: "error", error: any }`.**




{% capture snippet_lyyye4 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_lyyye4 | escape }}
```



## Schema-Driven Creation

### Automatic Default Values




{% capture snippet_yg8xxi %}{% include code/%}{% endcapture %}

```ts
{{ snippet_yg8xxi | escape }}
```



### Identity Field Generation




{% capture snippet_hgf9sv %}{% include code/%}{% endcapture %}

```ts
{{ snippet_hgf9sv | escape }}
```



### Nested Object Creation




{% capture snippet_knkpix %}{% include code/%}{% endcapture %}

```ts
{{ snippet_knkpix | escape }}
```



## Validation and Error Handling

### Schema Validation




{% capture snippet_y4xs72 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_y4xs72 | escape }}
```



### Type Validation




{% capture snippet_jv9ahy %}{% include code/%}{% endcapture %}

```ts
{{ snippet_jv9ahy | escape }}
```



### Constraint Validation




{% capture snippet_0b1hfq %}{% include code/%}{% endcapture %}

```ts
{{ snippet_0b1hfq | escape }}
```



## Advanced Create Patterns

### Conditional Creation




{% capture snippet_cnidll %}{% include code/%}{% endcapture %}

```ts
{{ snippet_cnidll | escape }}
```



### Batch Creation with Validation




{% capture snippet_xxyrbc %}{% include code/%}{% endcapture %}

```ts
{{ snippet_xxyrbc | escape }}
```



### Creation with Computed Fields




{% capture snippet_4705gv %}{% include code/%}{% endcapture %}

```ts
{{ snippet_4705gv | escape }}
```



## Performance Considerations

### Batch Creation




{% capture snippet_k1ho3m %}{% include code/%}{% endcapture %}

```ts
{{ snippet_k1ho3m | escape }}
```



### Memory Management




{% capture snippet_ltnx8g %}{% include code/%}{% endcapture %}

```ts
{{ snippet_ltnx8g | escape }}
```



## Best Practices

### 1. **Validate Data Before Creation**




{% capture snippet_u8ea3c %}{% include code/%}{% endcapture %}

```ts
{{ snippet_u8ea3c | escape }}
```



### 2. **Use Appropriate Default Values**




{% capture snippet_fc5ex3 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_fc5ex3 | escape }}
```



### 3. **Handle Errors Gracefully**




{% capture snippet_uf275q %}{% include code/%}{% endcapture %}

```ts
{{ snippet_uf275q | escape }}
```



### 4. **Leverage Schema Features**




{% capture snippet_n3llsb %}{% include code/%}{% endcapture %}

```ts
{{ snippet_n3llsb | escape }}
```



## Next Steps

- [Read Operations](read.md) - Learn how to query and retrieve data
- [Update Operations](update.md) - Learn how to modify existing entities
- [Delete Operations](delete.md) - Learn how to remove entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
