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
        Errors should terminate the operation, do not continue
        What about partial results?
            PartialResultType<T>
            Should we have transactions/retries
            Event Driven?
        Need to send in all changes at once vs by collection
            If we are dealing with a NoSql scenario where everything is stored as a key/value pair, there is no concept of tables/collections,
            we can just save everything in one shot.  Likewise, we can send the entire change package to the plugin and it can decide what to do with it
        Need unit testing
        history tracking ----> Replication
        context tracking
        Event store
        Can we move callbacks over to result pattern?
            {
                ok: true,
                result; T
            }

            {
                ok: false,
                error: any
            }

        entity changes -> updates does not need to be a map, why?
            does previewChanges need to divide out by schemaid?  Nah, just return all items

    Video's
        Why
        Getting Started
        Code Pens

    TODO
        Make sure we are serializing and deserializing dates correctly in Routier
        Test entity tagging
