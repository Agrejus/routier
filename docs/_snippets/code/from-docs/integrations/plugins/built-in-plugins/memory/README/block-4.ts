import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

// Different names are different databases
const userContext = new DataStore(new MemoryPlugin("users"));
const orderContext = new DataStore(new MemoryPlugin("orders"));

// The same name is the same database: records saved through one store are visible to the other
const tabOne = new DataStore(new MemoryPlugin("app"));
const tabTwo = new DataStore(new MemoryPlugin("app"));