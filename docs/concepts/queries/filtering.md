---
title: Filtering
---

# Filtering Data

Filter your data with `where` clauses to find exactly what you need.

## Quick Navigation

- [Simple Filtering](#simple-filtering)
- [Multiple Conditions](#multiple-conditions)
- [Parameterized Queries](#parameterized-queries)
- [Building Queries Conditionally](#building-queries-conditionally)
- [Notes](#notes)
- [Related](#related)

## Simple Filtering

Filter by a single condition:

<<< @/_snippets/code/from-docs/concepts/queries/filtering-simple.ts

## Multiple Conditions

Chain multiple `where` clauses for AND logic:

<<< @/_snippets/code/from-docs/concepts/queries/filtering-multiple.ts

## Parameterized Queries

Use parameters for dynamic filtering with variables. This is **required** when you want to use variables in your query predicates.

### Why Parameterized Queries?

When you need to use variables in your query, you must use parameterized queries. Direct variable usage in predicates will still work, but Routier will fall back to selecting all records because it cannot evaluate the variable values:


<<< @/_snippets/code/from-docs/concepts/queries/filtering/block-1.ts


**Result**: You'll get the correct filtered results, but Routier will first load all records into memory, then apply the filter. This is less efficient than database-level filtering.

### How Parameterized Queries Work

Pass variables through a parameters object:

<<< @/_snippets/code/from-docs/concepts/queries/filtering-parameterized.ts

### Common Use Cases

**Dynamic filtering based on user input:**


<<< @/_snippets/code/from-docs/concepts/queries/filtering/block-2.ts


**Pagination with dynamic page size:**


<<< @/_snippets/code/from-docs/concepts/queries/filtering/block-3.ts


## Building Queries Conditionally

You can build queries dynamically by assigning query results back to a variable and chaining additional operations conditionally:

<<< @/_snippets/code/from-docs/concepts/queries/dynamic-query-building.ts

### Key Pattern

Start with a base query and conditionally add filters:


<<< @/_snippets/code/from-docs/concepts/queries/filtering/block-4.ts


### Filtering by Arrays

Use parameterized queries with `includes()` to filter by multiple values:


<<< @/_snippets/code/from-docs/concepts/queries/filtering/block-5.ts


This pattern is especially useful when building queries in loops or based on conditional logic, as seen in Routier's internal view computation system.

## Notes

- `where` supports either a simple predicate `(item) => boolean` or a parameterized predicate `(item, params) => boolean` with a params object
- **Use parameterized queries when you need variables** - non-parameterized queries with variables will select all records and filter in memory (less efficient)
- Multiple `where` clauses are combined with AND logic
- For OR logic, use a single `where` with `||` operators inside the predicate

## Related

- [Sorting Results](/concepts/queries/sorting)
- [Pagination](/concepts/queries/pagination)
- [Terminal Methods](/concepts/queries/terminal-methods)
- [Query Composer](/concepts/queries/query-composer) - Build reusable parameterized queries
