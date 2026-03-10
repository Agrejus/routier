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
