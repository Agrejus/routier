- only non async queries (callback) can be subscribed to
  Yes -> dataStore.items.subscribe().toArray()
  No -> dataStore.items.subscribe().toArrayAsync()
