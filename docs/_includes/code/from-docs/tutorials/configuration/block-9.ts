// Removed testing plugin import; use MemoryPlugin in tests or mocks

class TestContext extends DataStore {
  constructor() {
    super(new TestingPlugin("test-app"));
  }
}