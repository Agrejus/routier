const isDevelopment = process.env.NODE_ENV === "development";

class DevContext extends DataStore {
  constructor() {
    if (isDevelopment) {
      super(new MemoryPlugin("dev-app"));
    } else {
      super(new PouchDbPlugin("prod-database"));
    }
  }
}