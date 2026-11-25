---
title: Sorting
---

# Sorting Results

Sort your data in ascending or descending order using `orderBy` and `orderByDescending`.

## Quick Navigation

- [Ascending Sort](#ascending-sort)
- [Descending Sort](#descending-sort)
- [Multiple Sort Criteria](#multiple-sort-criteria)
- [Combined with Filtering](#combined-with-filtering)
- [Related](#related)

## Ascending Sort

Sort data in ascending order:

<<< @/_snippets/code/from-docs/concepts/queries/sorting-ascending.ts

## Descending Sort

Sort data in descending order:

<<< @/_snippets/code/from-docs/concepts/queries/sorting-descending.ts

## Multiple Sort Criteria

Chain sorts to order by more than one value. The first sort decides the order, and each later sort only orders rows that tie on every sort before it:


<<< @/_snippets/code/from-docs/concepts/queries/sorting/block-1.ts

Every backend orders chained sorts the same way. A SQL backend runs them as one `ORDER BY`, with the columns in the order you wrote the sorts. Two dates with the same time are a tie, so the next sort decides between them.


## Combined with Filtering

Sort filtered results:


<<< @/_snippets/code/from-docs/concepts/queries/sorting/block-2.ts


## Related

- [Filtering Data](/concepts/queries/filtering)
- [Pagination](/concepts/queries/pagination)
- [Terminal Methods](/concepts/queries/terminal-methods)
