---
title: CRUD
layout: default
parent: Data Operations
has_children: true
nav_order: 1
---

# CRUD Operations

Routier provides a powerful and intuitive CRUD (Create, Read, Update, Delete) API that leverages change tracking and proxy-based entities for efficient data management.

## Overview

CRUD operations in Routier work through a **DataStore** class that you inherit from. The DataStore manages collections of entities and provides change tracking through proxy objects. Here's how it works:

1. **Create a DataStore** by inheriting from the base class
2. **Define collections** using schemas
3. **Perform operations** on collections (add, remove, update)
4. **Track changes** automatically through proxy entities
5. **Save changes** when ready to persist

## ⚠️ Critical: Persistence Requires Explicit Save

**Important: Changes made to entities (including adds, updates, and deletes) are NOT automatically persisted to the database. You must explicitly call `saveChanges()` or `saveChangesAsync()` to persist any changes.**

{% capture snippet_inlt8l %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_inlt8l | escape;
  }
}
```

## Creating a DataStore

### Basic Setup

{% capture snippet_c9yalp %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_c9yalp | escape;
  }
}
```

### Using Different Plugins

{% capture snippet_9rqdgd %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_9rqdgd | escape;
  }
}
```

## CRUD Operations

### Callback API Result Pattern

Routier uses a **discriminated union result pattern** for callback-based operations. The callback receives a single `result` parameter that can be either:

- **Success**: `{ ok: "success", data: T }`
- **Error**: `{ ok: "error", error: any }`

{% capture snippet_pvi8qq %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_pvi8qq | escape;
  }
}
```

### Create (Add)

#### Adding Single Entities

{% capture snippet_rpjfdj %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_rpjfdj | escape;
  }
}
```

#### Adding Multiple Entities

{% capture snippet_hum0xd %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_hum0xd | escape;
  }
}
```

#### Adding with Callbacks

{% capture snippet_5remab %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_5remab | escape;
  }
}
```

### Read (Query)

#### Basic Queries

{% capture snippet_plmliu %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_plmliu | escape;
  }
}
```

#### Filtered Queries

{% capture snippet_5ykcgs %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_5ykcgs | escape;
  }
}
```

#### Sorting and Pagination

{% capture snippet_orluis %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_orluis | escape;
  }
}
```

#### Aggregation

{% capture snippet_o89v2i %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_o89v2i | escape;
  }
}
```

### Update

#### Direct Property Updates

The key feature of Routier is that entities returned from queries are **proxy objects** that automatically track changes:

{% capture snippet_odwrsz %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_odwrsz | escape;
  }
}
```

#### Batch Updates

{% capture snippet_ajq9ip %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_ajq9ip | escape;
  }
}
```

#### Update with Callbacks

{% capture snippet_niq4xm %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_niq4xm | escape;
  }
}
```

### Delete (Remove)

#### Removing Single Entities

{% capture snippet_461037 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_461037 | escape;
  }
}
```

#### Removing Multiple Entities

{% capture snippet_z4pjbb %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_z4pjbb | escape;
  }
}
```

#### Removing by Query

{% capture snippet_ilub79 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_ilub79 | escape;
  }
}
```

#### Remove with Callbacks

{% capture snippet_ay5tzu %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_ay5tzu | escape;
  }
}
```

## Change Tracking and Persistence

### How Change Tracking Works

Routier uses **proxy objects** to automatically track changes to entities:

1. **Entities are proxied** when returned from queries
2. **Property changes are tracked** automatically
3. **Changes accumulate** in memory until you explicitly save them
4. **No manual update calls** needed for tracking
5. **Changes are NOT persisted until saveChanges() is called**

{% capture snippet_nm1j0m %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_nm1j0m | escape;
  }
}
```

### Checking for Changes

{% capture snippet_bru5vp %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_bru5vp | escape;
  }
}
```

### Saving Changes

**Important: Changes are NOT automatically persisted to the database. You must explicitly call `saveChanges()` or `saveChangesAsync()` to persist any changes.**

{% capture snippet_0of7vx %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_0of7vx | escape;
  }
}
```

## Complete CRUD Example

{% capture snippet_9k4u8w %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_9k4u8w | escape;
  }
}
```

## Best Practices

### 1. **Use Async Methods for Simplicity**

{% capture snippet_u6y5qk %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_u6y5qk | escape;
  }
}
```

### 2. **Leverage Change Tracking**

{% capture snippet_vjsaav %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_vjsaav | escape;
  }
}
```

### 3. **Batch Operations When Possible**

{% capture snippet_heqfkp %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_heqfkp | escape;
  }
}
```

### 4. **Save Changes Strategically**

**Critical: You must call `saveChanges()` or `saveChangesAsync()` to persist any changes to the database.**

{% capture snippet_firi5i %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_firi5i | escape;
  }
}
```

### 5. **Handle Errors Gracefully**

{% capture snippet_s9q7m4 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_s9q7m4 | escape;
  }
}
```

## Next Steps

- [Bulk Operations](bulk/) - Advanced bulk CRUD operations
- [Data Collections](../data-collections/) - Understanding collections and change tracking
- [Queries](../../core-concepts/queries/) - Advanced querying capabilities
- [State Management](../state-management/) - Managing application state with Routier
