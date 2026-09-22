import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, waitFor } from "@testing-library/dom";
import { logger } from "@routier/core/utilities";
import { MemoryPlugin } from "@routier/memory-plugin";
import type { InspectedCount, InspectedPage } from "@routier/datastore";
import { fakeCollection, fakeStore } from "../test/fakeCollections";
import { manualFrames } from "../test/frames";
import { interact, mount, type MountedDevtools } from "../test/harness";
import { spyOnInspection } from "../test/spyInspection";
import { createEmptyStore, createShopStore, disposeStores, seedProducts, type ShopStore } from "../test/stores";
import type { InspectableStore } from "@routier/devtools";

const mounted: MountedDevtools[] = [];

afterEach(() => {
  for (const devtools of mounted.splice(0)) devtools.unmount();
  disposeStores();
  jest.restoreAllMocks();
});

function open(store: InspectableStore): MountedDevtools {
  const devtools = mount(store);
  mounted.push(devtools);
  devtools.toggle();
  return devtools;
}

function countOf(devtools: MountedDevtools, name: string): string | null {
  return devtools.ui.getByRole("button", { name: new RegExp(`^${name}`) }).querySelector(".count")?.textContent ?? null;
}

function tableNames(devtools: MountedDevtools): ReadonlyArray<string | null> {
  const rows = devtools.ui.queryAllByRole("row").slice(1);
  return rows.map((row) => row.querySelectorAll("td")[1]?.textContent ?? null);
}

function range(devtools: MountedDevtools): string | null | undefined {
  return devtools.shadow.querySelector(".range")?.textContent;
}

function clickPager(devtools: MountedDevtools, label: "Next" | "Previous") {
  interact(() => {
    fireEvent.click(devtools.ui.getByRole("button", { name: label }));
  });
}

async function openProducts(store: ShopStore): Promise<MountedDevtools> {
  const devtools = open(store);
  devtools.select(/^products/);
  await waitFor(() => expect(devtools.ui.queryAllByRole("row").length).toBeGreaterThan(1));
  return devtools;
}

describe("row counts", () => {
  it("shows a count for every collection and view", async () => {
    const store = createShopStore();
    await seedProducts(store, 3);

    const devtools = open(store);

    await waitFor(() => {
      expect(countOf(devtools, "products")).toBe("3");
      expect(countOf(devtools, "orders")).toBe("0");
      expect(countOf(devtools, "productNames")).toBe("0");
    });
  });

  it("updates a count when a save lands", async () => {
    const store = createShopStore();
    const devtools = open(store);
    await waitFor(() => expect(countOf(devtools, "products")).toBe("0"));

    await seedProducts(store, 2);

    await waitFor(() => expect(countOf(devtools, "products")).toBe("2"));
  });

  it("shows counting until the first count arrives", () => {
    const devtools = open(fakeStore(fakeCollection("pending")));

    expect(devtools.ui.getByRole("button", { name: /^pending/ }).querySelector(".count")?.getAttribute("aria-label")).toBe("counting");
  });

  it("shows a failed count as an error and logs it", async () => {
    const logged = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    const failing = fakeCollection("broken", {
      watchCount: (onCount: (result: InspectedCount) => void) => {
        onCount({ status: "error", error: new Error("count exploded") });
        return () => undefined;
      },
    });

    const devtools = open(fakeStore(failing));

    await waitFor(() => expect(countOf(devtools, "broken")).toBe("error"));
    expect(devtools.shadow.querySelector(".count.error")?.getAttribute("title")).toBe("count exploded");
    expect(devtools.shadow.querySelector(".count.error")?.getAttribute("aria-label")).toBe("count failed: count exploded");
    expect(logged).toHaveBeenCalledWith("[routier-devtools] count of broken", new Error("count exploded"));
  });
});

describe("rows table", () => {
  it("prompts for a selection before one is made", () => {
    const devtools = open(createShopStore());

    expect(devtools.ui.getByRole("status").textContent).toBe("Select a collection or view to see its rows.");
  });

  it("marks the selected collection", async () => {
    const store = createShopStore();
    await seedProducts(store, 1);

    const devtools = await openProducts(store);

    expect(devtools.ui.getByRole("button", { name: /^products/ }).getAttribute("aria-pressed")).toBe("true");
    expect(devtools.ui.getByRole("button", { name: /^orders/ }).getAttribute("aria-pressed")).toBe("false");
  });

  it("shows the first 50 rows with a column per field", async () => {
    const store = createShopStore();
    await seedProducts(store, 120);

    const devtools = await openProducts(store);

    expect(devtools.ui.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["id", "name"]);
    expect(tableNames(devtools)).toHaveLength(50);
    expect(tableNames(devtools)[0]).toBe("product-000");
    await waitFor(() => expect(range(devtools)).toBe("1–50 of 120"));
  });

  it("pages forward and back through every row", async () => {
    const store = createShopStore();
    await seedProducts(store, 120);
    const devtools = await openProducts(store);
    await waitFor(() => expect(range(devtools)).toBe("1–50 of 120"));

    clickPager(devtools, "Next");
    await waitFor(() => expect(tableNames(devtools)[0]).toBe("product-050"));
    expect(range(devtools)).toBe("51–100 of 120");
    expect(devtools.ui.getByRole("button", { name: "Previous" }).hasAttribute("disabled")).toBe(false);

    clickPager(devtools, "Next");
    await waitFor(() => expect(tableNames(devtools)).toHaveLength(20));
    expect(range(devtools)).toBe("101–120 of 120");
    expect(devtools.ui.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(true);

    clickPager(devtools, "Previous");
    clickPager(devtools, "Previous");
    await waitFor(() => expect(tableNames(devtools)[0]).toBe("product-000"));
    expect(devtools.ui.getByRole("button", { name: "Previous" }).hasAttribute("disabled")).toBe(true);
  });

  it("disables Next when everything fits on one page", async () => {
    const store = createShopStore();
    await seedProducts(store, 50);

    const devtools = await openProducts(store);

    await waitFor(() => expect(range(devtools)).toBe("1–50 of 50"));
    expect(devtools.ui.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(true);
  });

  it("never asks for more than one page of rows", async () => {
    const store = createShopStore();
    await seedProducts(store, 120);
    const spy = spyOnInspection(store);
    const devtools = open(spy.store);
    devtools.select(/^products/);
    await waitFor(() => expect(tableNames(devtools)).toHaveLength(50));
    await waitFor(() => expect(range(devtools)).toBe("1–50 of 120"));

    clickPager(devtools, "Next");
    await waitFor(() => expect(tableNames(devtools)[0]).toBe("product-050"));

    expect(spy.pageRequests()).toEqual([
      { name: "products", skip: 0, take: 50 },
      { name: "products", skip: 50, take: 50 },
    ]);
  });

  it("adds a saved row to the open table", async () => {
    const store = createShopStore();
    await seedProducts(store, 1);
    const devtools = await openProducts(store);

    await seedProducts(store, 1, "added");

    await waitFor(() => expect(tableNames(devtools)).toEqual(["product-000", "added-000"]));
    await waitFor(() => expect(countOf(devtools, "products")).toBe("2"));
  });

  it("shows a change saved through another store on the same database", async () => {
    const plugin = new MemoryPlugin("devtools-shared-database");
    const inspected = createShopStore(plugin);
    const writer = createShopStore(plugin);
    await seedProducts(inspected, 1);
    const devtools = await openProducts(inspected);

    await seedProducts(writer, 1, "remote");

    await waitFor(() => expect(tableNames(devtools)).toEqual(["product-000", "remote-000"]));
  });

  it("steps back a page when rows on the current page are removed", async () => {
    const store = createShopStore();
    await seedProducts(store, 120);
    const devtools = await openProducts(store);
    await waitFor(() => expect(range(devtools)).toBe("1–50 of 120"));
    clickPager(devtools, "Next");
    await waitFor(() => expect(range(devtools)).toBe("51–100 of 120"));
    clickPager(devtools, "Next");
    await waitFor(() => expect(range(devtools)).toBe("101–120 of 120"));

    await store.products.removeAsync(...(await store.products.skip(60).toArrayAsync()));
    await store.saveChangesAsync();

    await waitFor(() => expect(range(devtools)).toBe("51–60 of 60"));
    await waitFor(() => expect(tableNames(devtools)).toHaveLength(10));
  });
});

describe("table states", () => {
  it("says so when the store has no collections or views", () => {
    const devtools = open(createEmptyStore());

    expect(devtools.ui.getByRole("status").textContent).toBe("This store has no collections or views.");
  });

  it("says so when a collection is empty", async () => {
    const devtools = open(createShopStore());
    devtools.select(/^orders/);

    await waitFor(() => expect(devtools.ui.getByRole("status").textContent).toBe("This collection is empty."));
    await waitFor(() => expect(range(devtools)).toBe("0 rows"));
  });

  it("shows loading until the first page arrives", () => {
    const devtools = open(fakeStore(fakeCollection("slow")));
    devtools.select(/^slow/);

    expect(devtools.ui.getByRole("status").textContent).toBe("Loading rows…");
    expect(range(devtools)).toBe("");
  });

  it("shows an empty page past the end distinctly from an empty collection", async () => {
    const page: InspectedPage = { status: "success", rows: [] };
    const paged = fakeCollection("paged", {
      watchCount: (onCount: (result: InspectedCount) => void) => {
        onCount({ status: "success", count: 75 });
        return () => undefined;
      },
      watchPage: (request, onRows: (result: InspectedPage) => void) => {
        onRows(request.skip === 0 ? { status: "success", rows: [{ id: "a" }] } : page);
        return () => undefined;
      },
    });
    const devtools = open(fakeStore(paged));
    devtools.select(/^paged/);
    await waitFor(() => expect(range(devtools)).toBe("1–50 of 75"));

    clickPager(devtools, "Next");

    await waitFor(() => expect(devtools.ui.getByRole("status").textContent).toBe("No rows on this page."));
  });

  it("shows a failed page as an error without throwing, and logs it", async () => {
    const logged = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    const failing = fakeCollection("broken", {
      watchPage: (_request, onRows: (result: InspectedPage) => void) => {
        onRows({ status: "error", error: new Error("page exploded") });
        return () => undefined;
      },
    });
    const devtools = open(fakeStore(failing));

    devtools.select(/^broken/);

    await waitFor(() => expect(devtools.ui.getByRole("alert").textContent).toBe("Could not load rows: page exploded"));
    expect(logged).toHaveBeenCalledWith("[routier-devtools] rows of broken", new Error("page exploded"));
  });

  it("shows an error when watching a page throws", async () => {
    const logged = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    const throwing = fakeCollection("throws", {
      watchPage: () => {
        throw new Error("subscribe exploded");
      },
    });
    const devtools = open(fakeStore(throwing));

    expect(() => devtools.select(/^throws/)).not.toThrow();

    await waitFor(() => expect(devtools.ui.getByRole("alert").textContent).toBe("Could not load rows: subscribe exploded"));
    expect(logged).toHaveBeenCalledWith("[routier-devtools] rows of throws", new Error("subscribe exploded"));
  });

  it("logs a non-Error failure as an Error", async () => {
    const logged = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    const throwing = fakeCollection("throws-text", {
      watchCount: () => {
        throw "count refused";
      },
    });

    const devtools = open(fakeStore(throwing));

    await waitFor(() => expect(countOf(devtools, "throws-text")).toBe("error"));
    expect(logged).toHaveBeenCalledWith("[routier-devtools] count of throws-text", new Error("count refused"));
  });

  it("logs a failure to stop watching without throwing", () => {
    const logged = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    const devtools = open(fakeStore(fakeCollection("sticky", {
      watchCount: () => () => {
        throw new Error("stop exploded");
      },
    })));

    expect(() => devtools.toggle()).not.toThrow();
    expect(logged).toHaveBeenCalledWith("[routier-devtools] count of sticky", new Error("stop exploded"));
  });

  it("shows a render failure inside the drawer instead of throwing", () => {
    const logged = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const exploding = fakeCollection("placeholder");
    Object.defineProperty(exploding, "kind", {
      get: () => {
        throw new Error("render exploded");
      },
    });

    const devtools = open(fakeStore(exploding));

    expect(devtools.ui.getByRole("alert").textContent).toBe("Devtools failed to render: render exploded");
    expect(logged).toHaveBeenCalledWith("[routier-devtools] render", new Error("render exploded"));
  });
});

describe("subscriptions", () => {
  it("watches only the selected collection's current page and the visible counts", async () => {
    const store = createShopStore();
    await seedProducts(store, 60);
    const spy = spyOnInspection(store);
    const devtools = open(spy.store);

    expect(spy.activePages()).toEqual([]);
    expect(spy.activeCounts()).toEqual(["products", "orders", "productNames"]);

    devtools.select(/^products/);
    expect(spy.activePages()).toEqual([{ name: "products", skip: 0, take: 50 }]);

    devtools.select(/^orders/);
    expect(spy.activePages()).toEqual([{ name: "orders", skip: 0, take: 50 }]);

    devtools.select(/^products/);
    await waitFor(() => expect(range(devtools)).toBe("1–50 of 60"));
    clickPager(devtools, "Next");
    expect(spy.activePages()).toEqual([{ name: "products", skip: 50, take: 50 }]);
  });

  it("watches nothing while the drawer is closed", async () => {
    const store = createShopStore();
    const spy = spyOnInspection(store);
    const devtools = mount(spy.store);
    mounted.push(devtools);

    expect(spy.activeCounts()).toEqual([]);

    devtools.toggle();
    devtools.select(/^products/);
    devtools.toggle();

    expect(spy.activeCounts()).toEqual([]);
    expect(spy.activePages()).toEqual([]);
  });
});

describe("render coalescing", () => {
  it("holds a burst of changes until the next animation frame, then shows them at once", async () => {
    const store = createShopStore();
    await seedProducts(store, 1);
    const spy = spyOnInspection(store);
    const frames = manualFrames();
    const devtools = open(spy.store);
    devtools.select(/^products/);
    await waitFor(() => expect(spy.pageDeliveries()).toBe(1));
    frames.flush();
    expect(tableNames(devtools)).toEqual(["product-000"]);

    for (let burst = 0; burst < 5; burst++) await seedProducts(store, 1, `burst-${burst}`);
    await waitFor(() => expect(spy.pageDeliveries()).toBe(6));

    expect(frames.pending()).toBe(1);
    expect(tableNames(devtools)).toEqual(["product-000"]);
    frames.flush();
    expect(tableNames(devtools)).toEqual(["product-000", ...[0, 1, 2, 3, 4].map((burst) => `burst-${burst}-000`)]);
    frames.restore();
  });

  it("drops updates still waiting for a frame when unmounted", async () => {
    const store = createShopStore();
    const spy = spyOnInspection(store);
    const frames = manualFrames();
    const devtools = open(spy.store);
    devtools.select(/^products/);
    await waitFor(() => expect(spy.pageDeliveries()).toBe(1));

    mounted.splice(0);
    devtools.unmount();

    expect(() => frames.flush()).not.toThrow();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
    frames.restore();
  });
});
