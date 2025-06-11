Can we put TTL on some of the records?  We can check every N times for TTLs and purge them

Are these needed?
    onBeforeSave
    onAfterSave

Collection
    Can we do caching? Stringify the function and use as cache key

Provide Custom Collection to restore legacy functionality
    pluck
        where(w => w).map(w => ({ test:w.test })).firstOrUndefined();

    filter
        where(w => w).toArray()

Can we do CDC so we can create history tables?
    Can we apply a TTL to documents?


  TODO:
    Make sure errors are reported correctly

History Records?  How can we use the replicator for this?
  DbReplicator -> Inherit and override query and bulkOperations
                  Filter for your collection
                  When Replicating, change the schema from the base to the history schema
                  