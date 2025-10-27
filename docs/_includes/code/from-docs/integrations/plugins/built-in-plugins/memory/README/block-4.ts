import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

// Different contexts can use different names
const userContext = new DataStore(new MemoryPlugin("users"));
const orderContext = new DataStore(new MemoryPlugin("orders"));