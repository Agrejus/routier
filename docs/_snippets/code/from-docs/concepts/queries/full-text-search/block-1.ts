const articleSchema = s.define('articles', {
    id: s.string().key().identity(),
    title: s.string().searchable(),
    body: s.string({ maxLength: 4000 }).searchable(),
    authorNote: s.string(),
    published: s.boolean(),
}).compile();

class AppStore extends DataStore {
    articles = this.collection(articleSchema)
        .fullTextSearch()
        .proxy()
        .create();
}

const hits = await store.articles.search('copper pipe').toArrayAsync();