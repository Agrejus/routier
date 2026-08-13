class AppStore extends DataStore {
    articles = this.collection(articleSchema)
        .fullTextSearch({ tokenizer: text => text.toLowerCase().split(/\s+/) })
        .proxy()
        .create();
}