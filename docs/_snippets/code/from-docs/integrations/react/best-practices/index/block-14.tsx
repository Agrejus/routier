import { renderHook, waitFor } from "@testing-library/react";

test("useQuery returns data", async () => {
  const store = createMockStore();
  await store.products.addAsync({ name: "Test" });
  await store.saveChangesAsync();

  const { result } = renderHook(
    () => useQuery((cb) => store.products.subscribe().toArray(cb), []),
    {
      wrapper: ({ children }) => (
        <DataStoreProvider store={store}>{children}</DataStoreProvider>
      ),
    }
  );

  await waitFor(() => {
    expect(result.current.status).toBe("success");
  });

  expect(result.current.data).toHaveLength(1);
});