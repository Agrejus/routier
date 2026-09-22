import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, waitFor } from "@testing-library/dom";
import { logger } from "@routier/core/utilities";
import type { InspectedCount, InspectedPage, InspectedPageRequest, InspectedRow } from "@routier/datastore";
import type { InspectableStore } from "@routier/devtools";
import { fakeCollection, fakeStore } from "../test/fakeCollections";
import { interact, mount, type MountedDevtools } from "../test/harness";
import { createShopStore, disposeStores, seedProducts } from "../test/stores";

const mounted: MountedDevtools[] = [];

afterEach(() => {
  for (const devtools of mounted.splice(0)) devtools.unmount();
  disposeStores();
  jest.restoreAllMocks();
});

function openCollection(store: InspectableStore, name: string): MountedDevtools {
  const devtools = mount(store);
  mounted.push(devtools);
  devtools.toggle();
  devtools.select(new RegExp(`^${name}`));
  return devtools;
}

function button(devtools: MountedDevtools, name: "Next" | "Previous"): HTMLElement {
  return devtools.ui.getByRole("button", { name });
}

function range(devtools: MountedDevtools): string | null | undefined {
  return devtools.shadow.querySelector(".range")?.textContent;
}

function rowsOf(count: number, prefix: string): ReadonlyArray<InspectedRow> {
  return Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}` }));
}

interface ControlledPages {
  readonly store: InspectableStore;
  readonly requests: InspectedPageRequest[];
  deliver(skip: number, page: InspectedPage): void;
}

function controlledPages(count: InspectedCount | null): ControlledPages {
  const listeners = new Map<number, (result: InspectedPage) => void>();
  const requests: InspectedPageRequest[] = [];
  const store = fakeStore(
    fakeCollection("paged", {
      watchCount: (onCount: (result: InspectedCount) => void) => {
        if (count !== null) onCount(count);
        return () => undefined;
      },
      watchPage: (request, onRows: (result: InspectedPage) => void) => {
        requests.push(request);
        listeners.set(request.skip, onRows);
        return () => undefined;
      },
    }),
  );
  return {
    store,
    requests,
    deliver: (skip, page) => listeners.get(skip)?.(page),
  };
}

describe("the rows panel", () => {
  it("is labelled with its collection", async () => {
    const store = createShopStore();
    await seedProducts(store, 1);

    const devtools = openCollection(store, "products");

    expect(devtools.ui.getByRole("region", { name: "products rows" })).toBeTruthy();
    expect(devtools.ui.getByRole("region", { name: "products rows" }).querySelector(".kind-badge")).toBeNull();
    expect(button(devtools, "Previous").querySelector("svg path")).not.toBeNull();
    expect(button(devtools, "Next").querySelector("svg path")).not.toBeNull();
  });

  it("marks an open view as a view", () => {
    const devtools = openCollection(createShopStore(), "productNames");

    expect(devtools.ui.getByRole("region", { name: "productNames rows" }).querySelector(".kind-badge")?.textContent).toBe("view");
  });

  it("asks for the first page before the count is known", () => {
    const pages = controlledPages(null);

    openCollection(pages.store, "paged");

    expect(pages.requests).toEqual([{ skip: 0, take: 50 }]);
  });
});

describe("paging without a count", () => {
  function failedCount(): InspectedCount {
    return { status: "error", error: new Error("count unavailable") };
  }

  it("allows Next when the page is full", async () => {
    jest.spyOn(logger, "error").mockImplementation(() => undefined);
    const pages = controlledPages(failedCount());
    const devtools = openCollection(pages.store, "paged");

    pages.deliver(0, { status: "success", rows: rowsOf(50, "first") });

    await waitFor(() => expect(button(devtools, "Next").hasAttribute("disabled")).toBe(false));
    expect(range(devtools)).toBe("");
  });

  it("disables Next when the page is not full", async () => {
    jest.spyOn(logger, "error").mockImplementation(() => undefined);
    const pages = controlledPages(failedCount());
    const devtools = openCollection(pages.store, "paged");

    pages.deliver(0, { status: "success", rows: rowsOf(49, "first") });

    await waitFor(() => expect(devtools.ui.getAllByRole("row")).toHaveLength(50));
    expect(button(devtools, "Next").hasAttribute("disabled")).toBe(true);
  });

  it("disables Next while the page loads", () => {
    jest.spyOn(logger, "error").mockImplementation(() => undefined);
    const pages = controlledPages(failedCount());

    const devtools = openCollection(pages.store, "paged");

    expect(button(devtools, "Next").hasAttribute("disabled")).toBe(true);
  });
});

describe("page changes", () => {
  it("ignores rows that arrive late for the page it left", async () => {
    const pages = controlledPages({ status: "success", count: 120 });
    const devtools = openCollection(pages.store, "paged");
    pages.deliver(0, { status: "success", rows: rowsOf(50, "first") });
    await waitFor(() => expect(range(devtools)).toBe("1–50 of 120"));

    interact(() => {
      fireEvent.click(button(devtools, "Next"));
    });
    pages.deliver(50, { status: "success", rows: rowsOf(50, "second") });
    await waitFor(() => expect(devtools.ui.getAllByRole("row")[1].textContent).toBe("second-0"));
    pages.deliver(0, { status: "success", rows: rowsOf(50, "stale") });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(devtools.ui.getAllByRole("row")[1].textContent).toBe("second-0");
  });

  it("steps back to the last full page when the count drops to a multiple of the page size", async () => {
    const store = createShopStore();
    await seedProducts(store, 150);
    const devtools = openCollection(store, "products");
    await waitFor(() => expect(range(devtools)).toBe("1–50 of 150"));
    interact(() => {
      fireEvent.click(button(devtools, "Next"));
    });
    await waitFor(() => expect(range(devtools)).toBe("51–100 of 150"));
    interact(() => {
      fireEvent.click(button(devtools, "Next"));
    });
    await waitFor(() => expect(range(devtools)).toBe("101–150 of 150"));

    await store.products.removeAsync(...(await store.products.skip(100).toArrayAsync()));
    await store.saveChangesAsync();

    await waitFor(() => expect(range(devtools)).toBe("51–100 of 100"));
  });
});
