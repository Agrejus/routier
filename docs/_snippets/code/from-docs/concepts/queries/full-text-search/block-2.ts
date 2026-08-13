// Documents containing BOTH words.
const strict = await store.articles.search('copper pipe').toArrayAsync();

// Documents containing EITHER word. Documents with both rank higher.
const loose = await store.articles.search('copper pipe', { match: 'any' }).toArrayAsync();