import { afterEach, describe, expect, it } from "@jest/globals";
import { fireEvent, waitFor } from "@testing-library/dom";
import { s } from "@routier/core/schema";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { interact, mount, type MountedDevtools } from "../tests/harness";
import { createShopStore, disposeStores, seedProducts } from "../tests/stores";
import type { InspectableStore } from "@routier/devtools";

const customerSchema = s.define("customers", {
  id: s.string().key(),
  name: s.string(),
  ssn: s.string().sensitive(),
  card: s.object({ number: s.string().sensitive(), brand: s.string() }),
}).compile();

class CustomerStore extends DataStore {
  customers = this.collection(customerSchema).proxy().create();
}

const mounted: MountedDevtools[] = [];
const stores: CustomerStore[] = [];

afterEach(() => {
  for (const devtools of mounted.splice(0)) devtools.unmount();
  for (const store of stores.splice(0)) store[Symbol.dispose]();
  disposeStores();
});

async function seededCustomers(): Promise<CustomerStore> {
  const store = new CustomerStore(new MemoryPlugin(`devtools-sensitive-${stores.length}`));
  stores.push(store);
  await store.customers.addAsync({ id: "c1", name: "Ada", ssn: "123-45-6789", card: { number: "4111111111111111", brand: "visa" } });
  await store.saveChangesAsync();
  return store;
}

async function open(store: InspectableStore, name: string): Promise<MountedDevtools> {
  const devtools = mount(store);
  mounted.push(devtools);
  devtools.toggle();
  devtools.select(new RegExp(`^${name}`));
  await waitFor(() => expect(devtools.ui.queryAllByRole("row").length).toBeGreaterThan(1));
  return devtools;
}

function panelText(devtools: MountedDevtools): string {
  return devtools.ui.getByRole("region", { name: /rows$/ }).textContent ?? "";
}

function openRow(devtools: MountedDevtools) {
  interact(() => {
    fireEvent.click(devtools.ui.getAllByRole("row")[1]);
  });
}

describe("sensitive values in devtools", () => {
  it("are masked in the table and the row detail", async () => {
    const devtools = await open(await seededCustomers(), "customers");
    openRow(devtools);

    const text = panelText(devtools);

    expect(text).toContain("Ada");
    expect(text).toContain("visa");
    expect(text).not.toContain("123-45-6789");
    expect(text).not.toContain("4111111111111111");
    expect(text).toContain("••••••");
  });

  it("are shown after asking, and hidden again", async () => {
    const devtools = await open(await seededCustomers(), "customers");
    const toggle = () => interact(() => {
      fireEvent.click(devtools.ui.getByRole("button", { name: /sensitive values/ }));
    });

    toggle();
    await waitFor(() => expect(panelText(devtools)).toContain("123-45-6789"));
    expect(devtools.ui.getByRole("button", { name: "Hide sensitive values" }).getAttribute("aria-pressed")).toBe("true");

    toggle();
    await waitFor(() => expect(panelText(devtools)).not.toContain("123-45-6789"));
  });

  it("offer no toggle for a collection with nothing sensitive", async () => {
    const store = createShopStore();
    await seedProducts(store, 1);
    const devtools = await open(store, "products");

    expect(devtools.ui.queryByRole("button", { name: /sensitive values/ })).toBeNull();
  });
});
