import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, waitFor } from "@testing-library/dom";
import { act } from "preact/test-utils";
import { logger } from "@routier/core/utilities";
import { mountRoutierDevtools, type InspectableStore, type UnmountDevtools } from "@routier/devtools";
import { interact, mount, type MountedDevtools } from "../tests/harness";
import { spyOnInspection } from "../tests/spyInspection";
import { createEmptyStore, createShopStore, disposeStores, seedProducts } from "../tests/stores";

const cleanups: UnmountDevtools[] = [];

function track(devtools: MountedDevtools): MountedDevtools {
  cleanups.push(devtools.unmount);
  return devtools;
}

afterEach(() => {
  for (const unmount of cleanups.splice(0)) unmount();
  disposeStores();
  jest.restoreAllMocks();
});

function hosts(): NodeListOf<Element> {
  return document.querySelectorAll("[data-routier-devtools]");
}

function picker(devtools: MountedDevtools): HTMLSelectElement | null {
  const select = devtools.ui.queryByRole("combobox", { name: "Store" });
  return select instanceof HTMLSelectElement ? select : null;
}

function pick(devtools: MountedDevtools, label: string) {
  const select = picker(devtools);
  if (select === null) throw new Error("no store picker");
  const option = [...select.options].find((candidate) => candidate.textContent === label);
  if (option === undefined) throw new Error(`no store named ${label}`);
  interact(() => {
    fireEvent.change(select, { target: { value: option.value } });
  });
}

const disposedMessage = "This store was disposed. Devtools stopped watching it.";

describe("store disposal", () => {
  it("shows that the store was disposed and releases every subscription", async () => {
    const store = createShopStore();
    await seedProducts(store, 1);
    const spy = spyOnInspection(store);
    const devtools = track(mount(spy.store));
    devtools.toggle();
    devtools.select(/^products/);
    await waitFor(() => expect(devtools.ui.getAllByRole("row")).toHaveLength(2));

    interact(() => store[Symbol.dispose]());

    expect(devtools.ui.getByRole("status").textContent).toBe(disposedMessage);
    expect(spy.activePages()).toEqual([]);
    expect(spy.activeCounts()).toEqual([]);
  });

  it("shows a store disposed before the drawer opened as disposed, without watching it", () => {
    const store = createShopStore();
    const spy = spyOnInspection(store);
    const devtools = track(mount(spy.store));
    store[Symbol.dispose]();

    devtools.toggle();

    expect(devtools.ui.getByRole("status").textContent).toBe(disposedMessage);
    expect(spy.activeCounts()).toEqual([]);
  });

  it("notices a disposal that lands while the drawer is opening", () => {
    const store = createShopStore();
    const devtools = track(mount(store));

    act(() => {
      fireEvent.click(devtools.ui.getByRole("button", { name: "Open Routier devtools" }));
      store[Symbol.dispose]();
    });

    expect(devtools.ui.getByRole("status").textContent).toBe(disposedMessage);
  });

  it("stops listening for disposal once unmounted", () => {
    const store = createShopStore();
    const devtools = mount(store);
    devtools.toggle();
    const { disposed } = store.inspect();
    const removed = jest.spyOn(disposed, "removeEventListener");

    devtools.unmount();

    expect(removed).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});

describe("mounting the same store twice", () => {
  it("does nothing the second time and hands back the same unmount", () => {
    const store = createShopStore();
    const inspect = jest.spyOn(store, "inspect");
    let first: UnmountDevtools = () => undefined;
    let second: UnmountDevtools = () => undefined;

    act(() => {
      first = mountRoutierDevtools(store);
      second = mountRoutierDevtools(store);
    });
    cleanups.push(() => act(() => first()));

    expect(second).toBe(first);
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(hosts()).toHaveLength(1);
  });

  it("shows no store picker for a single store mounted twice", () => {
    const store = createShopStore();
    const devtools = track(mount(store));
    mountRoutierDevtools(store);
    devtools.toggle();

    expect(picker(devtools)).toBeNull();
  });
});

describe("several stores", () => {
  it("shares one drawer behind a store picker", () => {
    const shop = track(mount(createShopStore()));
    track(mount(createEmptyStore()));
    shop.toggle();

    expect(hosts()).toHaveLength(1);
    expect([...(picker(shop)?.options ?? [])].map((option) => option.textContent)).toEqual(["ShopStore", "EmptyStore"]);
  });

  it("names stores by the name option, and tells same-named stores apart", () => {
    const first = track(mount(createShopStore()));
    track(mount(createShopStore()));
    track(mount(createShopStore()));
    track(mount(createShopStore(), { name: "Admin" }));
    track(mount(createShopStore(), { name: "Admin" }));
    first.toggle();

    expect([...(picker(first)?.options ?? [])].map((option) => option.textContent)).toEqual([
      "ShopStore",
      "ShopStore (2)",
      "ShopStore (3)",
      "Admin",
      "Admin (2)",
    ]);
  });

  it("shows the first store until another is picked", () => {
    const shop = track(mount(createShopStore()));
    track(mount(createEmptyStore()));
    shop.toggle();

    expect(shop.ui.getByRole("button", { name: /^products/ })).toBeTruthy();
    expect(picker(shop)?.value).toBe(picker(shop)?.options[0].value);
  });

  it("shows the plugin and database of the store on screen", () => {
    const shop = track(mount(createShopStore()));
    track(mount(createEmptyStore()));
    shop.toggle();
    const storage = () => shop.ui.getByLabelText("Storage");

    expect(storage().querySelector(".plugin-name")?.textContent).toBe("MemoryPlugin");
    expect(storage().querySelector(".database-name")?.textContent).toMatch(/^devtools-shop-\d+$/);
    expect(storage().getAttribute("title")).toMatch(/^MemoryPlugin · devtools-shop-\d+$/);

    pick(shop, "EmptyStore");

    expect(storage().querySelector(".database-name")?.textContent).toMatch(/^devtools-empty-\d+$/);
  });

  it("switches to the picked store", () => {
    const shop = track(mount(createShopStore()));
    track(mount(createEmptyStore()));
    shop.toggle();

    pick(shop, "EmptyStore");

    expect(shop.ui.getByRole("status").textContent).toBe("This store has no collections or views.");
    expect(picker(shop)?.selectedOptions[0].textContent).toBe("EmptyStore");
  });

  it("releases the previous store's subscriptions when switching", () => {
    const spy = spyOnInspection(createShopStore());
    const shop = track(mount(spy.store));
    track(mount(createEmptyStore()));
    shop.toggle();
    shop.select(/^products/);

    pick(shop, "EmptyStore");

    expect(spy.activeCounts()).toEqual([]);
    expect(spy.activePages()).toEqual([]);
  });

  it("clears the selection when switching back", () => {
    const shop = track(mount(createShopStore()));
    track(mount(createEmptyStore()));
    shop.toggle();
    shop.select(/^products/);

    pick(shop, "EmptyStore");
    pick(shop, "ShopStore");

    expect(shop.ui.getByRole("status").textContent).toBe("Select a collection or view to see its rows.");
  });
});

describe("unmount", () => {
  it("removes the host element and every subscription", () => {
    const spy = spyOnInspection(createShopStore());
    const devtools = mount(spy.store);
    devtools.toggle();
    devtools.select(/^products/);

    devtools.unmount();

    expect(hosts()).toHaveLength(0);
    expect(spy.activeCounts()).toEqual([]);
    expect(spy.activePages()).toEqual([]);
  });

  it("keeps the drawer for the stores still mounted", () => {
    const spy = spyOnInspection(createShopStore());
    const shop = mount(spy.store);
    const empty = track(mount(createEmptyStore()));
    shop.toggle();
    shop.select(/^products/);

    shop.unmount();

    expect(hosts()).toHaveLength(1);
    expect(picker(empty)).toBeNull();
    expect(empty.ui.getByRole("status").textContent).toBe("This store has no collections or views.");
    expect(spy.activeCounts()).toEqual([]);
    expect(spy.activePages()).toEqual([]);
  });

  it("is harmless when called twice", () => {
    const devtools = mount(createShopStore());
    const other = track(mount(createEmptyStore()));

    devtools.unmount();
    devtools.unmount();

    expect(hosts()).toHaveLength(1);
    expect(other.host.isConnected).toBe(true);
  });

  it("lets the same store mount again afterwards", () => {
    const store = createShopStore();
    mount(store).unmount();

    const again = track(mount(store));

    expect(hosts()).toHaveLength(1);
    expect(again.host.isConnected).toBe(true);
  });

  it("never throws, even when tearing down fails", () => {
    const logged = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    const store = createShopStore();
    const { disposed } = store.inspect();
    jest.spyOn(disposed, "removeEventListener").mockImplementation(() => {
      throw new Error("teardown exploded");
    });
    const devtools = mount(store);
    devtools.toggle();

    expect(() => devtools.unmount()).not.toThrow();
    expect(logged).toHaveBeenCalledWith("[routier-devtools] unmount", new Error("teardown exploded"));
    expect(hosts()).toHaveLength(0);
  });
});

describe("a mount that fails", () => {
  it("logs the failure, adds nothing to the page, and never throws", () => {
    const logged = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    const broken: InspectableStore = {
      inspect: () => {
        throw new Error("inspect exploded");
      },
    };

    const unmount = mountRoutierDevtools(broken);

    expect(hosts()).toHaveLength(0);
    expect(() => unmount()).not.toThrow();
    expect(logged).toHaveBeenCalledWith("[routier-devtools] mount", new Error("inspect exploded"));
  });
});
