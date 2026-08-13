const drift = await store.articles.fullTextSearch.check();
// { missing: 0, extra: 0, stale: 0, isHealthy: true }

if (drift.isHealthy === false) {
    await store.articles.fullTextSearch.rebuild();
}