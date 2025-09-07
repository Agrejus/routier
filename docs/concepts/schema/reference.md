# Schema Reference

Complete API reference for Routier schemas, including all methods, types, and advanced features.

## Schema Builder

### `s.object()`

Creates an object schema with the specified properties.




{% capture snippet_zkjtsz %}{% include code/%}{% endcapture %}

```ts
{{ snippet_zkjtsz | escape }}
```



### `s.define(name, properties)`

Defines a named schema with properties and returns a schema builder.




{% capture snippet_05owr1 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_05owr1 | escape }}
```



### `s.array(elementType)`

Creates an array schema with the specified element type.




{% capture snippet_pcv2m5 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_pcv2m5 | escape }}
```



### `s.union(types)`

Creates a union schema that accepts any of the specified types.




{% capture snippet_p2fxbx %}{% include code/%}{% endcapture %}

```ts
{{ snippet_p2fxbx | escape }}
```



### `s.literal(...values)`

Creates a literal schema that only accepts the specified values.




{% capture snippet_zli77j %}{% include code/%}{% endcapture %}

```ts
{{ snippet_zli77j | escape }}
```



### `s.any()`

Creates a schema that accepts any value.




{% capture snippet_8oiehv %}{% include code/%}{% endcapture %}

```ts
{{ snippet_8oiehv | escape }}
```



### `s.unknown()`

Creates a schema that accepts unknown values (safer than `any`).




{% capture snippet_ln12ss %}{% include code/%}{% endcapture %}

```ts
{{ snippet_ln12ss | escape }}
```



### `s.record(keyType, valueType)`

Creates a record schema for key-value pairs.




{% capture snippet_7jufvm %}{% include code/%}{% endcapture %}

```ts
{{ snippet_7jufvm | escape }}
```



## Property Types

### String Properties




{% capture snippet_2nkuuy %}{% include code/%}{% endcapture %}

```ts
{{ snippet_2nkuuy | escape }}
```



### Number Properties




{% capture snippet_jkp6m3 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_jkp6m3 | escape }}
```



### Boolean Properties




{% capture snippet_rclo3b %}{% include code/%}{% endcapture %}

```ts
{{ snippet_rclo3b | escape }}
```



### Date Properties




{% capture snippet_iipob8 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_iipob8 | escape }}
```



## Property Modifiers

### Identity and Keys




{% capture snippet_snx4al %}{% include code/%}{% endcapture %}

```ts
{{ snippet_snx4al | escape }}
```



### Indexing




{% capture snippet_c800du %}{% include code/%}{% endcapture %}

```ts
{{ snippet_c800du | escape }}
```



### Validation




{% capture snippet_95d00b %}{% include code/%}{% endcapture %}

```ts
{{ snippet_95d00b | escape }}
```



### Defaults and Values




{% capture snippet_5503v4 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_5503v4 | escape }}
```



### Behavior Control




{% capture snippet_7m792n %}{% include code/%}{% endcapture %}

```ts
{{ snippet_7m792n | escape }}
```



### Serialization




{% capture snippet_06sj57 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_06sj57 | escape }}
```



## Schema Modification

### `.modify(modifier)`

Applies modifications to the schema.




{% capture snippet_lgafm5 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_lgafm5 | escape }}
```



### Computed Properties




{% capture snippet_zuzs5v %}{% include code/%}{% endcapture %}

```ts
{{ snippet_zuzs5v | escape }}
```



### Function Properties




{% capture snippet_8hwrmn %}{% include code/%}{% endcapture %}

```ts
{{ snippet_8hwrmn | escape }}
```



## Schema Compilation

### `.compile()`

Compiles the schema into its final form.




{% capture snippet_fddsty %}{% include code/%}{% endcapture %}

```ts
{{ snippet_fddsty | escape }}
```



## Schema Information

### `.getProperties()`

Returns information about all properties in the schema.




{% capture snippet_19bz4t %}{% include code/%}{% endcapture %}

```ts
{{ snippet_19bz4t | escape }}
```



### `.getIndexes()`

Returns information about all indexes in the schema.




{% capture snippet_cjthvu %}{% include code/%}{% endcapture %}

```ts
{{ snippet_cjthvu | escape }}
```



### `.getIdProperties()`

Returns information about identity properties.




{% capture snippet_rwhjlt %}{% include code/%}{% endcapture %}

```ts
{{ snippet_rwhjlt | escape }}
```



### `.hasIdentityKeys`

Boolean indicating if the schema has identity keys.




{% capture snippet_fplcxj %}{% include code/%}{% endcapture %}

```ts
{{ snippet_fplcxj | escape }}
```



## Type Inference

### `InferType<T>`

Extracts the TypeScript type from a schema.




{% capture snippet_zzserb %}{% include code/%}{% endcapture %}

```ts
{{ snippet_zzserb | escape }}
```



### `InferCreateType<T>`

Extracts the creation type (without identity fields).




{% capture snippet_4gaf0f %}{% include code/%}{% endcapture %}

```ts
{{ snippet_4gaf0f | escape }}
```



## Schema Structure Checking

### `.validate(data)`

Validates data against the schema.




{% capture snippet_z0yl02 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_z0yl02 | escape }}
```



### `.isValid(data)`

Quick check if data is valid.




{% capture snippet_n1vtpw %}{% include code/%}{% endcapture %}

```ts
{{ snippet_n1vtpw | escape }}
```



## Schema Serialization

### `.serialize(data)`

Serializes data according to schema rules.




{% capture snippet_hpemqu %}{% include code/%}{% endcapture %}

```ts
{{ snippet_hpemqu | escape }}
```



### `.deserialize(data)`

Deserializes data according to schema rules.




{% capture snippet_azauja %}{% include code/%}{% endcapture %}

```ts
{{ snippet_azauja | escape }}
```



## Advanced Features

### Custom Validators




{% capture snippet_92nuzd %}{% include code/%}{% endcapture %}

```ts
{{ snippet_92nuzd | escape }}
```



### Conditional Validation




{% capture snippet_ju3pq7 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_ju3pq7 | escape }}
```



### Dynamic Schemas




{% capture snippet_c74ymd %}{% include code/%}{% endcapture %}

```ts
{{ snippet_c74ymd | escape }}
```



## Best Practices

### 1. **Schema Organization**




{% capture snippet_2uqlc6 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_2uqlc6 | escape }}
```



### 2. **Validation Strategy**




{% capture snippet_8ail1k %}{% include code/%}{% endcapture %}

```ts
{{ snippet_8ail1k | escape }}
```



### 3. **Type Safety**




{% capture snippet_2yg31j %}{% include code/%}{% endcapture %}

```ts
{{ snippet_2yg31j | escape }}
```



### 4. **Performance Considerations**




{% capture snippet_uz1yp3 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_uz1yp3 | escape }}
```



## Error Handling

### Validation Errors




{% capture snippet_sh61ip %}{% include code/%}{% endcapture %}

```ts
{{ snippet_sh61ip | escape }}
```



### Schema Compilation Errors




{% capture snippet_qzbwjx %}{% include code/%}{% endcapture %}

```ts
{{ snippet_qzbwjx | escape }}
```



## Next Steps

- [Creating A Schema](creating-a-schema.md) - Back to schema creation guide
- [Property Types](property-types/README.md) - Detailed property type reference
- [Modifiers](modifiers/README.md) - Property modifier reference
- [Why Schemas?](why-schemas.md) - Understanding schema benefits
