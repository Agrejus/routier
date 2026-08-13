const inBody = await store.articles
    .search(x => x.body, 'copper')
    .toArrayAsync();

const inEither = await store.articles
    .search([x => x.title, x => x.body], 'copper')
    .toArrayAsync();