---
title: Result Translation
layout: default
parent: Advanced Plugins
grand_parent: Integrations
nav_order: 2
---

## Result Translation

After executing queries against your backend, you need to translate the raw results back into the shape expected by Routier queries. The `DataTranslator` class hierarchy provides the framework for this.

## Overview

The translator's purpose is to **adapt query results based on what the backend can or cannot do natively**. For example:

- If your backend **supports COUNT natively** (like SQL), the translator just extracts the count value from the result
- If your backend **doesn't support COUNT** (like a simple in-memory store), the translator receives all data and counts it in memory

Routier provides two main translator implementations:

- **`JsonTranslator`**: For backends that don't support query operations natively—returns all data, translator performs operations in JavaScript
- **`SqlTranslator`**: For SQL backends that handle most operations natively—translator extracts/adjusts results from SQL queries

Both extend `DataTranslator`, which orchestrates the translation process based on what operations the backend already performed.

## How Translation Works

The `DataTranslator.translate()` method processes query results by applying each query option in order:

```ts
translate(data: unknown): TShape {
    this.query.options.forEach(item => {
        data = this.functionMap[item.name](data, item);
    });
    return data as TShape;
}
```

Translation happens in the **order operations were added** to the query, ensuring correct semantics.

## JsonTranslator

Used for backends that **don't support query operations natively**. The plugin returns all matching data, and the translator performs filtering, sorting, aggregation, and pagination in JavaScript.

### Operations Handled

#### Filtering

```ts
filter<TResult>(data: unknown, option: QueryOption<TShape, "filter">): TResult {
    if (option.value.filter) {
        if (option.value.params == null) {
            // Standard filtering
            return data.filter(option.value.filter) as TResult;
        }
        // Parameterized filtering
        const selector = option.value.filter as ParamsFilter<unknown, {}>
        return data.filter(w => selector([w, option.value.params])) as TResult;
    }
    return data as TResult;
}
```

#### Sorting

```ts
sort<TResult>(data: unknown, option: QueryOption<TShape, "sort">): TResult {
    if (Array.isArray(data)) {
        data.sort((a, b) => {
            const aVal = option.value.selector(a);
            const bVal = option.value.selector(b);
            return option.value.direction === "asc"
                ? aVal - bVal
                : bVal - aVal;
        });
    }
    return data as TResult;
}
```

#### Aggregations

- **count**: Returns `data.length`
- **sum**: Iterates and sums values (requires mapped field)
- **min/max**: Sorts and returns first element

#### Aggregations

Since the backend doesn't support aggregations natively:

```ts
count<TResult>(data: unknown, _: QueryOption<TShape, "count">): TResult {
    if (Array.isArray(data)) {
        return data.length as TResult; // Count all data in memory
    }
    throw new Error("Cannot count resulting data, it must be an array");
}

sum<TResult>(data: unknown, _: QueryOption<TShape, "sum">): TResult {
    assertIsArray(data);
    let sum = 0;
    for (const value of data) {
        if (typeof value !== "number") {
            throw new Error("Cannot sum, property is not a number");
        }
        sum += value; // Sum all data in memory
    }
    return sum as TResult;
}

min<TResult>(data: unknown, _: QueryOption<TShape, "min">): TResult {
    assertIsArray(data);
    data.sort((a, b) => a - b); // Sort all data in memory
    return data[0] as TResult; // Return first (minimum) element
}
```

**Why**: These backends don't have aggregate functions, so the translator receives all matching data and performs the calculation.

#### Pagination

- **skip**: `data.slice(option.value)` - Slices array in memory
- **take**: `data.slice(0, option.value)` - Takes first N items in memory

**Why**: Backend doesn't support LIMIT/OFFSET, so translator handles pagination.

#### Distinct

```ts
distinct<TResult>(data: unknown, _: QueryOption<TShape, "distinct">): TResult {
    const result = new Set<string | number | Date>();

    for (const value of data) {
        if (typeof value === "number" || typeof value === "string") {
            result.add(value);
        } else if (isDate(value)) {
            result.add(value.toISOString());
        }
    }

    return [...result] as TResult;
}
```

### When to Use JsonTranslator

Use `JsonTranslator` when your backend:

- **Doesn't support filtering** → Returns all data, translator filters in memory
- **Doesn't support sorting** → Returns unsorted data, translator sorts in memory
- **Doesn't support aggregations** (COUNT, SUM, MIN, MAX) → Translator calculates from all data
- **Doesn't support pagination** → Returns all data, translator applies skip/take

Common backends:

- Memory-based stores (MemoryPlugin)
- Simple key-value stores
- Backends that only support basic retrieval

## SqlTranslator

Used for SQL backends where **the database natively supports query operations**. The translator extracts and adjusts results since the database already performed the work.

### Key Differences from JsonTranslator

1. **Count**: SQL already executed `COUNT(*)`, so extract the value

   ```ts
   count<TResult>(data: unknown, _: QueryOption<TShape, "count">): TResult {
       if (Array.isArray(data) && data.length > 0) {
           return data[0].count; // SQL already calculated: { count: number }
       }
       return data as TResult;
   }
   ```

   **Why**: SQL natively supports COUNT, so the database already performed the operation. We just extract the result.

2. **Filter/Sort/Skip/Take**: No-op since SQL already handled these

   ```ts
   filter<TResult>(data: unknown, _: QueryOption<TShape, "filter">): TResult {
       return data as TResult; // SQL WHERE clause already filtered
   }
   ```

   **Why**: SQL's WHERE, ORDER BY, LIMIT, and OFFSET already performed these operations. The data is already in the correct shape.

3. **Min/Max/Sum**: Extract from SQL aggregate results

   ```ts
   min<TResult>(data: unknown, _: QueryOption<TShape, "min">): TResult {
       if (Array.isArray(data) && data.length > 0) {
           return data[0]; // SQL already found the min value
       }
       return data as TResult;
   }
   ```

   **Why**: SQL's `MIN()`, `MAX()`, `SUM()` functions already calculated the values. Just extract them.

4. **Map**: Still needed for field mapping and deserialization
   ```ts
   map(data: unknown, option: QueryOption<TShape, "map">): TShape {
       // Deserialize properties and apply selector
       for (const field of option.value.fields) {
           if (field.property != null) {
               const value = field.property.getValue(data[i]);
               if (value != null) {
                   field.property.setValue(data[i], field.property.deserialize(value));
               }
           }
       }
       response.push(option.value.selector(data[i]));
   }
   ```

### When to Use SqlTranslator

Use `SqlTranslator` when your backend:

- **Supports filtering natively** → Database performs WHERE clauses
- **Supports sorting natively** → Database performs ORDER BY
- **Supports aggregations natively** → Database performs COUNT, SUM, MIN, MAX, etc.
- **Supports pagination natively** → Database performs LIMIT/OFFSET

In these cases, the translator's job is to extract and adjust results, not perform the operations.

### Special Handling

- **Count with Map**: If count and map are both present, count takes precedence (SQL already calculated count, mapping not needed)
- **Min/Max/Sum**: Extract single value from SQL result array (database already calculated the aggregate)

## Map Operation

Both translators handle the `map` operation, which:

1. **Deserializes** property values (e.g., JSON strings → objects, date strings → Date objects)
2. **Applies** the selector function to transform the shape
3. **Handles** nested property access and computed properties

```ts
map(data: unknown, option: QueryOption<TShape, "map">): TShape {
    const response = [];

    for (const entity of data) {
        // Deserialize each mapped field
        for (const field of option.value.fields) {
            if (field.property != null) {
                const value = field.property.getValue(entity);
                if (value != null) {
                    // Deserialize (e.g., JSON.parse, Date conversion)
                    field.property.setValue(entity, field.property.deserialize(value));
                }
            }
        }

        // Apply selector to reshape
        response.push(option.value.selector(entity));
    }

    return response as TShape;
}
```

## Decision: Which Translator to Use?

The choice between `JsonTranslator` and `SqlTranslator` (or creating your own) depends on **what your backend can do natively**:

| Operation       | Backend Doesn't Support                 | Backend Supports                               |
| --------------- | --------------------------------------- | ---------------------------------------------- |
| **Filter**      | Return all data → Translator filters    | Apply WHERE → Translator passes through        |
| **Count**       | Return all data → Translator counts     | Execute COUNT(\*) → Translator extracts        |
| **Sort**        | Return unsorted → Translator sorts      | Apply ORDER BY → Translator passes through     |
| **Skip/Take**   | Return all data → Translator slices     | Apply LIMIT/OFFSET → Translator passes through |
| **Min/Max/Sum** | Return all data → Translator calculates | Execute aggregate → Translator extracts        |

### Hybrid Approach

Your backend might support some operations but not others. You can create a custom translator that:

- Passes through operations your backend handles (like `SqlTranslator`)
- Performs operations your backend doesn't handle (like `JsonTranslator`)

## Creating Your Own Translator

If your backend needs custom translation logic, extend `DataTranslator` and implement methods based on what your backend supports:

```ts
import { DataTranslator } from "@routier/core/plugins/translators/DataTranslator";
import { QueryOption } from "@routier/core/plugins/query/types";

export class MyCustomTranslator<
  TRoot extends {},
  TShape
> extends DataTranslator<TRoot, TShape> {
  // Override only the methods that need custom behavior
  count<TResult extends number>(
    data: unknown,
    option: QueryOption<TShape, "count">
  ): TResult {
    // Custom count handling
    return data.length as TResult;
  }

  // Other methods can use base class behavior
  // or override for backend-specific needs
}
```

### Usage in Plugin

```ts
query<TRoot extends {}, TShape>(
    event: DbPluginQueryEvent<TRoot, TShape>,
    done: PluginEventCallbackResult<TShape>
): void {
    const translator = new MyCustomTranslator(event.operation);

    // Execute query against your backend
    this.executeQuery(event.operation, (result) => {
        if (result.ok === "error") {
            done(PluginEventResult.error(event.id, result.error));
            return;
        }

        // Translate raw results to expected shape
        const translated = translator.translate(result.data);
        done(PluginEventResult.success(event.id, translated));
    });
}
```

## Common Patterns

### Deserialization

The schema handles deserialization automatically through property-level `deserialize()` methods. You don't need to manually deserialize in the translator. The `map` operation already handles deserialization for mapped fields:

```ts
// Inside map() - deserialization happens automatically
for (const field of option.value.fields) {
  if (field.property != null) {
    const value = field.property.getValue(data[i]);
    if (value != null) {
      // Property's deserialize() method is called here
      field.property.setValue(data[i], field.property.deserialize(value));
    }
  }
}
```

If your backend returns raw data that needs schema-level deserialization, handle it in your plugin's `query` method before passing to the translator, not in the translator itself.

### Hybrid: Backend Supports Some Operations

If your backend supports some operations but not others, check what was handled:

```ts
override count<TResult extends number>(
    data: unknown,
    option: QueryOption<TShape, "count">
): TResult {
    // If your backend executed COUNT natively
    if (this.backendPerformedCount) {
        // Extract the count value (like SqlTranslator)
        return (data as any)[0].count as TResult;
    }

    // Otherwise, count in memory (like JsonTranslator)
    if (Array.isArray(data)) {
        return data.length as TResult;
    }
    throw new Error("Cannot count");
}
```

### Filtering After Fetch

If your backend doesn't support certain filters, fetch and filter in memory:

```ts
override filter<TResult>(
    data: unknown,
    option: QueryOption<TShape, "filter">
): TResult {
    // If backend handled filtering via WHERE clause, return as-is
    if (this.queryWasFilteredByBackend) {
        return data as TResult; // Already filtered
    }

    // Otherwise, filter in memory (backend doesn't support this filter)
    return super.filter(data, option); // Use JsonTranslator behavior
}
```

The key principle: **If your backend already did the work, extract the result. If not, do the work in the translator.**

### Result Shaping

Transform backend-specific result structures:

```ts
override count<TResult extends number>(
    data: unknown,
    option: QueryOption<TShape, "count">
): TResult {
    // Your backend returns count differently
    if (Array.isArray(data) && data.length > 0) {
        return (data[0] as any).totalCount as TResult;
    }
    return 0 as TResult;
}
```

## Reference Implementations

- **[JsonTranslator](https://github.com/agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.ts)**: Full in-memory operations
- **[SqlTranslator](https://github.com/agrejus/routier/blob/main/core/src/plugins/translators/SqlTranslator.ts)**: SQL result handling
- **[PouchDbTranslator](https://github.com/agrejus/routier/blob/main/plugins/pouchdb/src/PouchDbTranslator.ts)**: Custom deserialization example

## Testing

See [JsonTranslator.test.ts](https://github.com/agrejus/routier/blob/main/core/src/plugins/translators/JsonTranslator.test.ts) for comprehensive test examples covering all translation operations.
