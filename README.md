## What is Routier

Universal ORM abstraction that lets you easily use or switch between different ORM frameworks and data stores.

Can we put TTL on some of the records? We can check every N times for TTLs and purge them

# TODO:

Remove Proxies, change over to context tracking
Make sure errors are reported correctly
History Records? How can we use the replicator for this?
DbReplicator -> Inherit and override query and bulkOperations
Filter for your collection
When Replicating, change the schema from the base to the history schema

Right now, we cannot support stateful dbsets.  
Reason: Querying is fine, it is saveChanges that is the problem, we now saveChanges in the DataStore
which does not have access to the stateful set. We currently go to each set and grab its changes,
each set does not know how to save changes. Right now we will need to use the optimistic replicator
