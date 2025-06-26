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
        history tracking
        context tracking
        investigate immutable again
        match/isMatch
        markDirty
        how are we going to handle removes for subscriptions?
            payload -> { changes: { doc: InferType<T>, type: "update" | "add" | "remove }[] }


    Video's
        Why
        Getting Started
        Code Pens

    TODO
        min -> string/number/Date
        max -> string/number/Date
        sum -> number
        count -> any
        distinct -> any
            ^^^^ all need work, how are the API's looking?  Do we want to have min/max/sum have a more narrow selector expression?  Support string/number/Dates?