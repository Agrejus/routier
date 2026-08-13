// test-utils/mockStore.ts
import { MemoryPlugin } from "@routier/memory-plugin";
import { DataStore } from "@routier/datastore";

export function createMockStore() {
  return new DataStore(new MemoryPlugin("test"));
}

// Usage in tests
import { render } from "@testing-library/react";
import { DataStoreProvider } from "../contexts/DataStoreContext";

function renderWithStore(component: ReactElement, store: DataStore) {
  return render(
    <DataStoreProvider store={store}>{component}</DataStoreProvider>
  );
}

test("renders products", () => {
  const store = createMockStore();
  // Populate store with test data
  store.products.addAsync({ name: "Test Product" });

  renderWithStore(<ProductsList />, store);
  // Assertions...
});