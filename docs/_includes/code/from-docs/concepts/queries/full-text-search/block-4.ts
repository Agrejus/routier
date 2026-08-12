const hits = await store.articles.search('copper').toArrayAsync();

for (const hit of hits) {
    console.log(hit.title, hit.score);
}