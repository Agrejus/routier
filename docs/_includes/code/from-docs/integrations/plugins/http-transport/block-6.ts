// `where` is sent; `map` runs on the client, over the rows the server returned
await store.members.where(m => m.rank > 15).map(m => m.name).toArrayAsync();