// Different contexts can use different names
const userContext = new DataStore(new MemoryPlugin("users"));
const orderContext = new DataStore(new MemoryPlugin("orders"));