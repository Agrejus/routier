import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, waitFor } from "@testing-library/dom";
import type { QueryExplanation } from "@routier/core/plugins";
import { logger } from "@routier/core/utilities";
import type { InspectedQuery, StoreInspection } from "@routier/datastore";
import type { InspectableStore } from "@routier/devtools";
import { interact, mount, type MountedDevtools } from "../tests/harness";
import { createShopStore, disposeStores, seedProducts } from "../tests/stores";

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

function showQueries(devtools: MountedDevtools) {
  interact(() => {
    fireEvent.click(devtools.ui.getByRole("tab", { name: "Queries" }));
  });
}

function recorded(devtools: MountedDevtools): ReadonlyArray<HTMLElement> {
  return [...devtools.shadow.querySelectorAll<HTMLElement>(".query-item")];
}

const explanation: QueryExplanation = {
  collection: "orders",
  database: "shop-db",
  plugin: { kind: "SqliteDbPlugin" },
  summary: { database: 2, memory: 1, reasons: ["not-parsable"], explanation: "2 options ran in the database, 1 ran in memory." },
  executionSteps: [
    {
      step: 1,
      of: 3,
      executedIn: { kind: "database", database: "shop-db", plugin: "SqliteDbPlugin" },
      options: [
        { index: 0, name: "filter" },
        { index: 1, name: "sort" },
      ],
      executedQueries: [
        { text: "SELECT * FROM orders WHERE status = ?", parameters: ["pending"] },
        { text: "SELECT count(*) FROM orders" },
      ],
    },
    {
      step: 2,
      of: 3,
      executedIn: { kind: "memory" },
      options: [{ index: 2, name: "map" }],
      reason: "not-parsable",
      explanation: "A filter could not be parsed.",
    },
    {
      step: 3,
      of: 3,
      executedIn: { kind: "memory" },
      options: [],
    },
  ],
};

function query(overrides: Partial<InspectedQuery> = {}): InspectedQuery {
  return {
    sequence: 1,
    collection: "orders",
    live: false,
    at: new Date(2024, 0, 2, 3, 4, 5, 6).getTime(),
    durationMs: 3.25,
    outcome: { status: "success" },
    explanation,
    ...overrides,
  };
}

interface QueryFeed {
  readonly store: InspectableStore;
  emit(next: InspectedQuery): void;
  watching(): number;
  starts(): number;
}

function queryFeed(overrides: Partial<StoreInspection> = {}): QueryFeed {
  const listeners = new Set<(next: InspectedQuery) => void>();
  let starts = 0;
  const inspection: StoreInspection = {
    plugin: { name: "FakePlugin", databaseName: "fake-db" },
    collections: [],
    disposed: new AbortController().signal,
    watchQueries: (onQuery) => {
      starts++;
      listeners.add(onQuery);
      return () => {
        listeners.delete(onQuery);
      };
    },
    ...overrides,
  };
  return {
    store: { inspect: () => inspection },
    emit: (next) => {
      for (const listener of listeners) listener(next);
    },
    watching: () => listeners.size,
    starts: () => starts,
  };
}

describe("view tabs", () => {
  it("opens on the data view", () => {
    const devtools = open(createShopStore());

    expect(devtools.ui.getByRole("tab", { name: "Data" }).getAttribute("aria-selected")).toBe("true");
    expect(devtools.ui.getByRole("tab", { name: "Queries" }).getAttribute("aria-selected")).toBe("false");
    expect(devtools.ui.getByRole("tablist", { name: "Devtools views" })).toBeTruthy();
  });

  it("switches to the queries view and back", () => {
    const devtools = open(createShopStore());

    showQueries(devtools);
    expect(devtools.ui.getByRole("tab", { name: "Queries" }).getAttribute("aria-selected")).toBe("true");
    expect(devtools.ui.getAllByRole("status")[0].textContent).toBe(
      "Queries your app runs appear here while this tab is open. Change some data to see one.",
    );

    interact(() => {
      fireEvent.click(devtools.ui.getByRole("tab", { name: "Data" }));
    });
    expect(devtools.ui.getByRole("button", { name: /^products/ })).toBeTruthy();
  });
});

describe("recording queries from a store", () => {
  it("records the queries the app runs while the tab is open, and only then", async () => {
    const store = createShopStore();
    await seedProducts(store, 2);
    const devtools = open(store);
    await store.products.toArrayAsync();

    showQueries(devtools);
    await store.products.where((product) => product.name !== "x").toArrayAsync();

    await waitFor(() => expect(recorded(devtools)).toHaveLength(1));
    expect(recorded(devtools)[0].querySelector(".query-collection")?.textContent).toBe("products");
    expect(recorded(devtools)[0].querySelector(".pushdown-database")?.textContent).toBe("DB 1");
    expect(recorded(devtools)[0].querySelector(".query-duration")?.textContent).toMatch(/ms$/);
    expect(devtools.shadow.querySelector(".recording")?.textContent).toBe("Recording · 1 query");
  });

  it("labels live queries and their re-runs", async () => {
    const store = createShopStore();
    const devtools = open(store);
    showQueries(devtools);
    const unsubscribe = store.products.subscribe().toArray(() => undefined);
    await waitFor(() => expect(recorded(devtools)).toHaveLength(1));

    await seedProducts(store, 1);
    await waitFor(() => expect(recorded(devtools)).toHaveLength(2));
    unsubscribe();

    expect(recorded(devtools).map((item) => item.querySelector(".live-badge")?.textContent)).toEqual(["live", "live"]);
    expect(recorded(devtools)[0].querySelector(".query-duration")?.textContent).toBe("live re-run");
  });

  it("stops recording when the tab closes", async () => {
    const feed = queryFeed();
    const devtools = open(feed.store);

    showQueries(devtools);
    expect(feed.watching()).toBe(1);

    interact(() => {
      fireEvent.click(devtools.ui.getByRole("tab", { name: "Data" }));
    });
    expect(feed.watching()).toBe(0);
  });
});

describe("recording several stores", () => {
  function recordedStores(devtools: MountedDevtools): ReadonlyArray<string | null> {
    return recorded(devtools).map((item) => item.querySelector(".query-store")?.textContent ?? null);
  }

  it("records every mounted store, labelled with its store", async () => {
    const first = queryFeed();
    const second = queryFeed();
    const devtools = open(first.store);
    const other = mount(second.store, { name: "Second" });
    mounted.push(other);
    showQueries(devtools);

    first.emit(query({ sequence: 1 }));
    second.emit(query({ sequence: 1 }));

    await waitFor(() => expect(recordedStores(devtools)).toEqual(["Second", "Object"]));
  });

  it("starts recording a store mounted while the tab is open", async () => {
    const first = queryFeed();
    const late = queryFeed();
    const devtools = open(first.store);
    showQueries(devtools);

    const lateDevtools = mount(late.store, { name: "Late" });
    mounted.push(lateDevtools);
    late.emit(query());

    await waitFor(() => expect(recordedStores(devtools)).toEqual(["Late"]));
    expect(first.watching()).toBe(1);
  });

  it("stops recording a store once it is unmounted", () => {
    const first = queryFeed();
    const leaving = queryFeed();
    const devtools = open(first.store);
    const leavingDevtools = mount(leaving.store, { name: "Leaving" });
    showQueries(devtools);
    expect(leaving.watching()).toBe(1);

    leavingDevtools.unmount();

    expect(leaving.watching()).toBe(0);
    expect(first.watching()).toBe(1);
  });

  it("starts watching each store once, however often the panel updates", async () => {
    const feed = queryFeed();
    const devtools = open(feed.store);
    showQueries(devtools);

    feed.emit(query({ sequence: 1 }));
    feed.emit(query({ sequence: 2 }));
    await waitFor(() => expect(recorded(devtools)).toHaveLength(2));

    expect(feed.starts()).toBe(1);
  });

  it("logs a store that fails to stop when it leaves", () => {
    const logged = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    const first = queryFeed();
    const leaving = queryFeed({
      watchQueries: () => () => {
        throw new Error("leave exploded");
      },
    });
    const devtools = open(first.store);
    const leavingDevtools = mount(leaving.store, { name: "Leaving" });
    showQueries(devtools);

    expect(() => leavingDevtools.unmount()).not.toThrow();
    expect(logged).toHaveBeenCalledWith("[routier-devtools] queries", new Error("leave exploded"));
  });

  it("keeps recording when an unrelated store leaves", async () => {
    const first = queryFeed();
    const leaving = queryFeed();
    const devtools = open(first.store);
    const leavingDevtools = mount(leaving.store, { name: "Leaving" });
    showQueries(devtools);

    leavingDevtools.unmount();
    first.emit(query());

    await waitFor(() => expect(recorded(devtools)).toHaveLength(1));
  });
});

describe("the query list", () => {
  it("lists queries newest first, keeping the most recent 200", async () => {
    const feed = queryFeed();
    const devtools = open(feed.store);
    showQueries(devtools);

    for (let sequence = 1; sequence <= 205; sequence++) feed.emit(query({ sequence, collection: `c${sequence}` }));

    await waitFor(() => expect(recorded(devtools)).toHaveLength(200));
    expect(recorded(devtools)[0].querySelector(".query-collection")?.textContent).toBe("c205");
    expect(recorded(devtools)[199].querySelector(".query-collection")?.textContent).toBe("c6");
    expect(devtools.shadow.querySelector(".recording")?.textContent).toBe("Recording · 200 queries");
  });

  it("shows the time, the pushdown split, and the duration", async () => {
    const feed = queryFeed();
    const devtools = open(feed.store);
    showQueries(devtools);

    feed.emit(query());
    feed.emit(query({ sequence: 2, durationMs: 42.6, explanation: { ...explanation, summary: { ...explanation.summary, memory: 0 } } }));
    feed.emit(query({ sequence: 3, durationMs: 10 }));

    await waitFor(() => expect(recorded(devtools)).toHaveLength(3));
    const [boundary, slow, fast] = recorded(devtools);
    expect(boundary.querySelector(".query-duration")?.textContent).toBe("10 ms");
    expect(fast.querySelector(".query-time")?.textContent).toBe("03:04:05.006");
    expect(fast.querySelector(".pushdown")?.textContent).toBe("DB 2Memory 1");
    expect(fast.querySelector(".query-duration")?.textContent).toBe("3.3 ms");
    expect(slow.querySelector(".pushdown-memory")).toBeNull();
    expect(slow.querySelector(".query-duration")?.textContent).toBe("43 ms");
    expect(slow.querySelector(".live-badge")).toBeNull();
    expect(slow.classList.contains("failed")).toBe(false);
  });

  it("marks a failed query", async () => {
    const feed = queryFeed();
    const devtools = open(feed.store);
    showQueries(devtools);

    feed.emit(query({ outcome: { status: "error", error: new Error("disk full") } }));

    await waitFor(() => expect(recorded(devtools)).toHaveLength(1));
    expect(recorded(devtools)[0].classList.contains("failed")).toBe(true);
    expect(recorded(devtools)[0].querySelector(".error-badge")?.textContent).toBe("failed");
  });

  it("clears", async () => {
    const feed = queryFeed();
    const devtools = open(feed.store);
    showQueries(devtools);
    const clear = devtools.ui.getByRole("button", { name: "Clear" });
    expect(clear.hasAttribute("disabled")).toBe(true);
    feed.emit(query());
    await waitFor(() => expect(recorded(devtools)).toHaveLength(1));
    expect(devtools.ui.getByRole("button", { name: "Clear" }).hasAttribute("disabled")).toBe(false);
    interact(() => {
      fireEvent.click(recorded(devtools)[0]);
    });

    interact(() => {
      fireEvent.click(devtools.ui.getByRole("button", { name: "Clear" }));
    });

    expect(recorded(devtools)).toHaveLength(0);
    expect(devtools.ui.queryByRole("region", { name: "Query detail" })).toBeNull();
    expect(devtools.shadow.querySelector(".recording")?.textContent).toBe("Recording · 0 queries");
  });
});

describe("the query detail", () => {
  async function openDetail(next: InspectedQuery): Promise<MountedDevtools> {
    const feed = queryFeed();
    const devtools = open(feed.store);
    showQueries(devtools);
    feed.emit(next);
    await waitFor(() => expect(recorded(devtools)).toHaveLength(1));
    expect(devtools.ui.getByRole("status").textContent).toBe(
      "Select a query to see how it ran: what the database did, and what ran in memory.",
    );
    interact(() => {
      fireEvent.click(recorded(devtools)[0]);
    });
    return devtools;
  }

  function detail(devtools: MountedDevtools): HTMLElement {
    return devtools.ui.getByRole("region", { name: "Query detail" });
  }

  it("marks only the selected query", async () => {
    const feed = queryFeed();
    const devtools = open(feed.store);
    showQueries(devtools);
    feed.emit(query({ sequence: 1 }));
    feed.emit(query({ sequence: 2 }));
    await waitFor(() => expect(recorded(devtools)).toHaveLength(2));

    interact(() => {
      fireEvent.click(recorded(devtools)[1]);
    });

    expect(recorded(devtools).map((item) => item.getAttribute("aria-pressed"))).toEqual(["false", "true"]);
  });

  it("summarises where the work ran", async () => {
    const devtools = await openDetail(query());

    expect(detail(devtools).querySelector(".query-detail-title")?.textContent).toBe("orders");
    expect(detail(devtools).querySelector(".query-detail-meta")?.textContent).toBe("03:04:05.006 · 3.3 ms · SqliteDbPlugin · shop-db");
    expect(detail(devtools).querySelector(".query-summary")?.textContent).toBe("2 options ran in the database, 1 ran in memory.");
  });

  it("shows each step, its options, and the statements the database ran", async () => {
    const devtools = await openDetail(query());
    const [database, memory, bare] = [...detail(devtools).querySelectorAll<HTMLElement>(".step")];

    expect(database.getAttribute("aria-label")).toBe("Step 1 of 3");
    expect(database.classList.contains("step-database")).toBe(true);
    expect(database.querySelector(".step-where")?.textContent).toBe("Database · SqliteDbPlugin");
    expect([...database.querySelectorAll(".step-option")].map((option) => option.textContent)).toEqual(["filter", "sort"]);
    expect([...database.querySelectorAll(".statement-text")].map((statement) => statement.textContent)).toEqual([
      "SELECT * FROM orders WHERE status = ?",
      "SELECT count(*) FROM orders",
    ]);
    expect([...database.querySelectorAll(".statement-parameters")].map((parameters) => parameters.textContent)).toEqual([
      '[\n  "pending"\n]',
    ]);
    expect(memory.classList.contains("step-memory")).toBe(true);
    expect(memory.querySelector(".step-where")?.textContent).toBe("Memory");
    expect(memory.querySelector(".step-note")?.textContent).toBe("A filter could not be parsed.");
    expect(bare.querySelector(".step-options")).toBeNull();
    expect(bare.querySelector(".step-note")?.textContent).toBe("Runs in memory over the rows the database returned.");
  });

  it("says when the plugin reported no statements", async () => {
    const [first] = explanation.executionSteps;
    const silent = { ...first, executedQueries: [], executedQueriesUnsupported: "This plugin did not report what it executed." };
    const quiet = { ...first, executedQueries: [{ text: "SELECT 1", parameters: [] }] };
    const unreported = { ...first, executedQueries: [] };
    const devtools = await openDetail(query({ explanation: { ...explanation, executionSteps: [silent, quiet, unreported] } }));
    const notes = [...detail(devtools).querySelectorAll(".step-note")].map((note) => note.textContent);

    expect(notes).toEqual(["This plugin did not report what it executed.", "No statements were reported."]);
    expect(detail(devtools).querySelectorAll(".statement-parameters")).toHaveLength(0);
  });

  it("shows why a query failed", async () => {
    const devtools = await openDetail(query({ outcome: { status: "error", error: new Error("disk full") } }));

    expect(devtools.ui.getByRole("alert").textContent).toBe("The query failed: disk full");
  });
});

describe("recording failures", () => {
  it("logs a failure to start recording and still shows the tab", () => {
    const logged = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    const feed = queryFeed({
      watchQueries: () => {
        throw new Error("watch exploded");
      },
    });
    const devtools = open(feed.store);

    showQueries(devtools);

    expect(logged).toHaveBeenCalledWith("[routier-devtools] queries", new Error("watch exploded"));
    expect(devtools.shadow.querySelector(".recording")?.textContent).toBe("Recording · 0 queries");

    interact(() => {
      fireEvent.click(devtools.ui.getByRole("tab", { name: "Data" }));
    });
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it("logs a failure to stop recording without throwing", () => {
    const logged = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    const feed = queryFeed({
      watchQueries: () => () => {
        throw new Error("stop exploded");
      },
    });
    const devtools = open(feed.store);
    showQueries(devtools);

    expect(() =>
      interact(() => {
        fireEvent.click(devtools.ui.getByRole("tab", { name: "Data" }));
      }),
    ).not.toThrow();
    expect(logged).toHaveBeenCalledWith("[routier-devtools] queries", new Error("stop exploded"));
  });
});
