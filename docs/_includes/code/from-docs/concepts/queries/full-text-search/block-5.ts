const hits = await store.articles
    .search('copper pipe')
    .where(x => x.published === true)
    .take(10)
    .toArrayAsync();