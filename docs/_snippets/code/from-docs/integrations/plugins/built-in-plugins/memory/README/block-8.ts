import { MemoryPlugin } from "@routier/memory-plugin";

new MemoryPlugin(databaseName?: string)

// Constructor
// @param databaseName - Name of the in-process database to connect to. Instances with the same
//                       name share one database. Defaults to "__routier-memory-plugin-db__", so
//                       every unnamed instance shares the same default database.