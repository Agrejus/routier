# Beta

npm publish --tag beta

Docs
Overiew
Type System
Reference PDB EF and DB EF

        Installation
        One Router Instance per DB

    Quick Start
    Schema
        Creating A Schema
        Reference
    Plugins
        Local Storage
        File System
        PouchDB
        Dexie
        Sqlite
        Replication <--------- History/Versioning for undo/redo
        Optimistic Replication
        Logging
        Create Your Own
    Queries
        Expressions
            Expression Tree
    React
    Data Modification
        Create
        Update
        Delete
    Guides
        Data Manipulation
        Data Context Setup
        State Management
        Optimistic Updates
        Entity Tagging
        History Tracking
    Live Queries
    Performance & Profiling
    Examples
    Reference
    Change Log
    Demos

    Missing
        history tracking ----> Replication
        context tracking
        how are we going to handle removes for subscriptions?
            If something is removed, we just rerun the subscription again which should not return the removed items thus making them removed
                example: x => x.id == 1 is your filter, if you remove the item with the id of 1, just rerun the subscription, which will return nothing making it removed.
                    We only want to rerun with nothing on removals, otherwise we will be spamming our subscriptions for no reason
                    See this page for how it should operate: https://dexie.org/docs/liveQuery()
        will this work with syncing?
            How can we optionally push data to a subscription from syncing?
            Need a sync engine we can give data and it can decide what to do
                Operations
                    add, update, remove
                        these all need to use the sync engine


    Video's
        Why
        Getting Started
        Code Pens

    TODO
        Make sure we are serializing and deserializing dates correctly in Routier
        Test entity tagging
