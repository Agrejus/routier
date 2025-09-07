// Perfect for unit tests
class TestContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("test"));
  }
}