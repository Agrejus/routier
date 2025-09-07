# Delete Operations

Delete operations in Routier allow you to remove entities from your collections. The framework provides both individual and batch deletion methods, with support for query-based removal and proper cleanup.

## Overview

Routier's delete operations feature:

1. **Individual entity removal** - Remove specific entities by reference
2. **Batch deletion** - Remove multiple entities efficiently
3. **Query-based removal** - Remove entities matching specific criteria
4. **Automatic cleanup** - Proper disposal of removed entities
5. **Change tracking** - Deletions are tracked until saved

## ⚠️ Important: Persistence Requires Save

**Note: When you call `removeAsync()`, the entity is marked for removal in memory, but it is NOT automatically removed from the database. You must call `saveChanges()` or `saveChangesAsync()` to persist the deletion.**

## Basic Delete Operations

### Removing Single Entities




{% capture snippet_7mnuqn %}{% include code/%}{% endcapture %}

```ts
{{ snippet_7mnuqn | escape }}
```



### Removing Multiple Entities




{% capture snippet_i4h7cy %}{% include code/%}{% endcapture %}

```ts
{{ snippet_i4h7cy | escape }}
```



### Removing with Callbacks




{% capture snippet_o2pl49 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_o2pl49 | escape }}
```



## Query-Based Deletion

### Remove by Query




{% capture snippet_jowtyu %}{% include code/%}{% endcapture %}

```ts
{{ snippet_jowtyu | escape }}
```



### Remove with Complex Criteria




{% capture snippet_ntn7jz %}{% include code/%}{% endcapture %}

```ts
{{ snippet_ntn7jz | escape }}
```



### Remove with Parameters




{% capture snippet_fexf0e %}{% include code/%}{% endcapture %}

```ts
{{ snippet_fexf0e | escape }}
```



## Batch Deletion Patterns

### Remove by Status




{% capture snippet_khspbq %}{% include code/%}{% endcapture %}

```ts
{{ snippet_khspbq | escape }}
```



### Remove with Confirmation




{% capture snippet_pjopln %}{% include code/%}{% endcapture %}

```ts
{{ snippet_pjopln | escape }}
```



### Remove with Backup




{% capture snippet_kdmz4x %}{% include code/%}{% endcapture %}

```ts
{{ snippet_kdmz4x | escape }}
```



## Advanced Deletion Patterns

### Cascading Deletion




{% capture snippet_9c2sj8 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_9c2sj8 | escape }}
```



### Soft Deletion




{% capture snippet_p26y1b %}{% include code/%}{% endcapture %}

```ts
{{ snippet_p26y1b | escape }}
```



### Conditional Deletion




{% capture snippet_2s8ypq %}{% include code/%}{% endcapture %}

```ts
{{ snippet_2s8ypq | escape }}
```



## Change Management for Deletions

### Checking Deletion Changes




{% capture snippet_56jqdx %}{% include code/%}{% endcapture %}

```ts
{{ snippet_56jqdx | escape }}
```



### Saving Deletion Changes




{% capture snippet_ca6a7p %}{% include code/%}{% endcapture %}

```ts
{{ snippet_ca6a7p | escape }}
```



### Rolling Back Deletions




{% capture snippet_nlb686 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_nlb686 | escape }}
```



## Performance Considerations

### Batch Deletion




{% capture snippet_f10lqn %}{% include code/%}{% endcapture %}

```ts
{{ snippet_f10lqn | escape }}
```



### Large Dataset Deletion




{% capture snippet_bdc0uw %}{% include code/%}{% endcapture %}

```ts
{{ snippet_bdc0uw | escape }}
```



## Error Handling

### Safe Deletion




{% capture snippet_kx3x6d %}{% include code/%}{% endcapture %}

```ts
{{ snippet_kx3x6d | escape }}
```



### Deletion with Recovery




{% capture snippet_ju9hps %}{% include code/%}{% endcapture %}

```ts
{{ snippet_ju9hps | escape }}
```



## Best Practices

### 1. **Confirm Deletions for Important Data**




{% capture snippet_3o6p0t %}{% include code/%}{% endcapture %}

```ts
{{ snippet_3o6p0t | escape }}
```



### 2. **Use Appropriate Deletion Methods**




{% capture snippet_vewmxn %}{% include code/%}{% endcapture %}

```ts
{{ snippet_vewmxn | escape }}
```



### 3. **Handle Related Data Appropriately**




{% capture snippet_acizfz %}{% include code/%}{% endcapture %}

```ts
{{ snippet_acizfz | escape }}
```



### 4. **Log Deletion Operations**




{% capture snippet_gxg1tw %}{% include code/%}{% endcapture %}

```ts
{{ snippet_gxg1tw | escape }}
```



## Next Steps

- [Create Operations](create.md) - Learn how to add new entities
- [Read Operations](read.md) - Learn how to query and retrieve data
- [Update Operations](update.md) - Learn how to modify existing entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
