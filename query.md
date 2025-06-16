## Permutations

collection
    first(): subscription?
    firstOrUndefined() : subscription?
    toArray() : subscription?
    some() : subscription?
    every() : subscription?

    firstAsync() : Result
    firstOrUndefinedAsync() : Result
    toArrayAsync() : Result
    someAsync() : Result
    everyAsync() : Result

    min() : subscription?
    max() : subscription?
    sum() : subscription?
    count() : subscription?
    distinct() : subscription?

    minAsync() : Result
    maxAsync() : Result
    sumAsync() : Result
    countAsync() : Result
    distinctAsync() : Result

    .where(): Queryable -> FilterableQueryable
        everything

    FilterableQueryable:
        .where()

    map() : ProjectedQueryable -> inhert from .where()
        skip() : SkippedQueryable ->  inhert from .where()
        take() : LimitedQueryable ->  inhert from .where()
        sort() : SortedQueryable ->  inhert from .where()
        sortDescending() : SortedQueryable ->  inhert from .where()


    skip() : Queryable
    take() : Queryable
    sort() : SortedQueryable
    sortDescending() : SortedQueryable


.where()
    first(): SelectionQuery
    firstOrUndefined() : SelectionQuery
    toArray() : SelectionQuery
    some() : SelectionQuery
    every() : SelectionQuery

    firstAsync() : SelectionQueryAsync
    firstOrUndefinedAsync() : SelectionQueryAsync
    toArrayAsync() : SelectionQueryAsync
    someAsync() : SelectionQueryAsync
    everyAsync() : SelectionQueryAsync

    min()
    max()
    sum()
    count()
    distinct()

    map()
    skip()
    take()
    sort()
    sortDescending()


    remove
    removeAsync
    subscribe

