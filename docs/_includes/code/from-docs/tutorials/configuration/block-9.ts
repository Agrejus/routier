import { TestingPlugin } from "routier-plugin-testing";

class TestContext extends DataStore {
  constructor() {
    super(new TestingPlugin("test-app"));
  }
}