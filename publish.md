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
        Entity Tagging <----- Test this
        .link & .unlink
        empty 
        history tracking
        context tracking
        investigate immutable again
        match/isMatch
        markDirty
        how are we going to handle removes for subscriptions?
            payload -> { changes: { doc: InferType<T>, type: "update" | "add" | "remove }[] }

        // Change removals - Keep original, also add ability for expressions, then we can remove all by using an empty expression
        .collection.remove(entities);
        .collection.where(x => x.id === 1).remove()
        .collection.removeAll();

        Need to move Expressions to classes so we can have a .EMPTY, that way we can distinguish between empty and null for select all queries
        Make an expression class, so we can have a .EMPTY property on it
        We can support live queries on a remove expression, we just run subscription query again since we have no data to filter



    Video's
        Why
        Getting Started
        Code Pens