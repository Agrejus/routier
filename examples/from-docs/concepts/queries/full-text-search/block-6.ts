// The ten best matches, titles only.
const titles = await store.articles
    .search('copper')
    .take(10)
    .map(x => x.title)
    .toArrayAsync();