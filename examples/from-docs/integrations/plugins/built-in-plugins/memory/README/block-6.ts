// For applications requiring maximum speed
class PerformanceContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("performance"));
  }
}