import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

// Different contexts can use different names
class UserContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("users"));
    }
}

class OrderContext extends DataStore {
    constructor() {
        super(new MemoryPlugin("orders"));
    }
}

const userContext = new UserContext();
const orderContext = new OrderContext();