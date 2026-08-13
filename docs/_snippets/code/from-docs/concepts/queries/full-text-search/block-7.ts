class AppStore extends DataStore {
    articles = this.collection(articleSchema)
        .fullTextSearch({
            lowercase: true,       // default true
            minTokenLength: 2,     // default 2 — drops "a" and "I"
            maxTokenLength: 64,    // default 64 — longer words are shortened, not dropped
            stopWords: 'none',     // 'english' | string[] | 'none'; default 'none'
        })
        .proxy()
        .create();
}