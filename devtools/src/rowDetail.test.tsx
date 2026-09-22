import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, waitFor } from "@testing-library/dom";
import { logger } from "@routier/core/utilities";
import type { InspectedPage, InspectedRow } from "@routier/datastore";
import { fakeCollection, fakeStore } from "../test/fakeCollections";
import { interact, mount, type MountedDevtools } from "../test/harness";
import { addProfile, createProfileStores, disposeProfileStores } from "../test/profileStores";
import { createShopStore, disposeStores, seedProducts } from "../test/stores";
import type { InspectableStore } from "@routier/devtools";

const mounted: MountedDevtools[] = [];

afterEach(() => {
  for (const devtools of mounted.splice(0)) devtools.unmount();
  disposeProfileStores();
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

function rowContaining(devtools: MountedDevtools, text: string): HTMLElement {
  const row = devtools.ui.getAllByRole("row").find((candidate) => candidate.textContent?.includes(text));
  if (row === undefined) throw new Error(`no row contains ${text}`);
  return row;
}

function openRow(devtools: MountedDevtools, text: string) {
  interact(() => {
    fireEvent.click(rowContaining(devtools, text));
  });
}

function detailText(devtools: MountedDevtools): string | null | undefined {
  return devtools.ui.queryByRole("region", { name: "Row detail" })?.querySelector("pre")?.textContent;
}

function fixedRow(row: InspectedRow): InspectableStore {
  const page: InspectedPage = { status: "success", rows: [row] };
  return fakeStore(
    fakeCollection("fixed", {
      watchPage: (_request, onRows: (result: InspectedPage) => void) => {
        onRows(page);
        return () => undefined;
      },
    }),
  );
}

async function openFixedRow(row: InspectedRow): Promise<MountedDevtools> {
  const devtools = openCollection(fixedRow(row), "fixed");
  await waitFor(() => expect(devtools.ui.getAllByRole("row")).toHaveLength(2));
  openRow(devtools, String(row.id));
  return devtools;
}

describe("row detail from a store", () => {
  it("shows the full value with nested objects and arrays, dates, and decrypted fields", async () => {
    const { store } = createProfileStores();
    await addProfile(store, "Ada");
    const devtools = openCollection(store, "profiles");
    await waitFor(() => rowContaining(devtools, "Ada"));

    openRow(devtools, "Ada");

    expect(devtools.ui.getByRole("heading", { name: "Row" })).toBeTruthy();
    const id = (await store.profiles.firstAsync()).id;
    expect(detailText(devtools)).toBe(
      [
        "{",
        `  id: ${JSON.stringify(id)},`,
        '  name: "Ada",',
        "  joinedAt: Date(2024-03-01T12:00:00.000Z),",
        "  address: {",
        '    city: "Lisbon",',
        '    zip: "1100"',
        "  },",
        "  tags: [",
        '    "admin",',
        '    "beta"',
        "  ],",
        '  secret: "hunter2"',
        "}",
      ].join("\n"),
    );
  });

  it("shows the value the app reads, not the value that is stored", async () => {
    const { store, raw } = createProfileStores();
    await addProfile(store, "Ada");
    const devtools = openCollection(store, "profiles");
    await waitFor(() => rowContaining(devtools, "Ada"));

    openRow(devtools, "Ada");

    expect((await raw.profiles.firstAsync()).secret).toBe("sealed:2retnuh");
    expect(detailText(devtools)).toContain('secret: "hunter2"');
    expect(detailText(devtools)).not.toContain("sealed:");
    expect(rowContaining(devtools, "Ada").textContent).toContain("hunter2");
  });

  it("marks the open row as selected", async () => {
    const store = createShopStore();
    await seedProducts(store, 2);
    const devtools = openCollection(store, "products");
    await waitFor(() => rowContaining(devtools, "product-001"));

    openRow(devtools, "product-001");

    expect(rowContaining(devtools, "product-001").getAttribute("aria-selected")).toBe("true");
    expect(rowContaining(devtools, "product-000").getAttribute("aria-selected")).toBe("false");
  });

  it("updates the open row when the row changes", async () => {
    const { store } = createProfileStores();
    await addProfile(store, "Ada");
    const devtools = openCollection(store, "profiles");
    await waitFor(() => rowContaining(devtools, "Ada"));
    openRow(devtools, "Ada");

    const profile = await store.profiles.firstAsync();
    profile.name = "Grace";
    await store.saveChangesAsync();

    await waitFor(() => expect(detailText(devtools)).toContain('name: "Grace"'));
  });

  it("says the row was removed when it is removed", async () => {
    const store = createShopStore();
    await seedProducts(store, 2);
    const devtools = openCollection(store, "products");
    await waitFor(() => rowContaining(devtools, "product-001"));
    openRow(devtools, "product-001");

    await store.products.removeAsync(await store.products.firstAsync((product) => product.name === "product-001"));
    await store.saveChangesAsync();

    await waitFor(() => expect(devtools.ui.getByRole("heading", { name: "Row removed" })).toBeTruthy());
    expect(devtools.ui.getByRole("region", { name: "Row detail" }).querySelector(".state-message")?.textContent).toBe(
      "This row is no longer on this page. It was removed, or a change moved it to another page.",
    );
  });

  it("closes", async () => {
    const store = createShopStore();
    await seedProducts(store, 1);
    const devtools = openCollection(store, "products");
    await waitFor(() => rowContaining(devtools, "product-000"));
    openRow(devtools, "product-000");

    interact(() => {
      fireEvent.click(devtools.ui.getByRole("button", { name: "Close row detail" }));
    });

    expect(devtools.ui.queryByRole("region", { name: "Row detail" })).toBeNull();
  });

  it("closes when the page changes", async () => {
    const store = createShopStore();
    await seedProducts(store, 60);
    const devtools = openCollection(store, "products");
    await waitFor(() => rowContaining(devtools, "product-000"));
    await waitFor(() => expect(devtools.ui.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(false));
    openRow(devtools, "product-000");

    interact(() => {
      fireEvent.click(devtools.ui.getByRole("button", { name: "Next" }));
    });

    expect(devtools.ui.queryByRole("region", { name: "Row detail" })).toBeNull();
  });

  it.each(["Enter", " "])("opens with the %j key", async (key) => {
    const store = createShopStore();
    await seedProducts(store, 1);
    const devtools = openCollection(store, "products");
    await waitFor(() => rowContaining(devtools, "product-000"));

    interact(() => {
      fireEvent.keyDown(rowContaining(devtools, "product-000"), { key });
    });

    expect(detailText(devtools)).toContain('name: "product-000"');
  });

  it("ignores other keys", async () => {
    const store = createShopStore();
    await seedProducts(store, 1);
    const devtools = openCollection(store, "products");
    await waitFor(() => rowContaining(devtools, "product-000"));

    interact(() => {
      fireEvent.keyDown(rowContaining(devtools, "product-000"), { key: "Tab" });
    });

    expect(devtools.ui.queryByRole("region", { name: "Row detail" })).toBeNull();
  });
});

describe("row detail when the page fails", () => {
  it("hides the open row and shows the error", async () => {
    jest.spyOn(logger, "error").mockImplementation(() => undefined);
    let deliver: (result: InspectedPage) => void = () => undefined;
    const store = fakeStore(
      fakeCollection("flaky", {
        watchPage: (_request, onRows: (result: InspectedPage) => void) => {
          deliver = onRows;
          onRows({ status: "success", rows: [{ id: "only" }] });
          return () => undefined;
        },
      }),
    );
    const devtools = openCollection(store, "flaky");
    await waitFor(() => rowContaining(devtools, "only"));
    openRow(devtools, "only");

    deliver({ status: "error", error: new Error("backend went away") });

    await waitFor(() => expect(devtools.ui.getByRole("alert").textContent).toBe("Could not load rows: backend went away"));
    expect(devtools.ui.queryByRole("region", { name: "Row detail" })).toBeNull();
  });
});

describe("special values", () => {
  it("renders each special value type as readable text", async () => {
    const devtools = await openFixedRow({
      id: "special",
      big: 12345678901234567890n,
      when: new Date("2024-01-02T03:04:05.000Z"),
      never: new Date(Number.NaN),
      lookup: new Map<string, number>([["a", 1], ["b", 2]]),
      unique: new Set(["x"]),
      bytes: new Uint8Array([1, 2, 3]),
      wide: new BigInt64Array([5n]),
      buffer: new ArrayBuffer(8),
      view: new DataView(new ArrayBuffer(4)),
      blob: new Blob(["hello"], { type: "text/plain" }),
      untyped: new Blob(["hi"]),
      pattern: /ab+c/gi,
      failure: new TypeError("bad input"),
      named: function handler() {},
      anonymous: [() => undefined][0],
      marker: Symbol("tag"),
      missing: undefined,
      nothing: null,
      flag: true,
      "odd key": 1,
      empty: {},
      none: [],
      noEntries: new Map(),
    });

    expect(detailText(devtools)).toBe(
      [
        "{",
        '  id: "special",',
        "  big: 12345678901234567890n,",
        "  when: Date(2024-01-02T03:04:05.000Z),",
        "  never: Date(Invalid Date),",
        "  lookup: Map(2) {",
        '    "a" => 1,',
        '    "b" => 2',
        "  },",
        "  unique: Set(1) {",
        '    "x"',
        "  },",
        "  bytes: Uint8Array(3) [1, 2, 3],",
        "  wide: BigInt64Array(1) [5n],",
        "  buffer: ArrayBuffer(8 bytes),",
        "  view: DataView(4 bytes),",
        "  blob: Blob(5 bytes, text/plain),",
        "  untyped: Blob(2 bytes),",
        "  pattern: /ab+c/gi,",
        "  failure: TypeError: bad input,",
        "  named: [Function handler],",
        "  anonymous: [Function],",
        "  marker: Symbol(tag),",
        "  missing: undefined,",
        "  nothing: null,",
        "  flag: true,",
        '  "odd key": 1,',
        "  empty: {},",
        "  none: [],",
        "  noEntries: Map(0) {}",
        "}",
      ].join("\n"),
    );
  });

  it("colours the row detail by token", async () => {
    const node: {
      id: string;
      "odd key": number;
      wide: number;
      huge: number;
      big: bigint;
      ok: boolean;
      none: null;
      when: Date;
      self?: object;
    } = {
      id: "hi",
      "odd key": -1.25,
      wide: 42,
      huge: 1e21,
      big: 2n,
      ok: true,
      none: null,
      when: new Date("2024-01-02T03:04:05.000Z"),
    };
    node.self = node;
    const devtools = await openFixedRow(node);

    const spans = [...(devtools.ui.getByRole("region", { name: "Row detail" }).querySelectorAll("pre span"))].map(
      (span) => `${span.className}:${span.textContent}`,
    );

    expect(spans).toEqual([
      "tone-key:id",
      'tone-string:"hi"',
      'tone-key:"odd key"',
      "tone-number:-1.25",
      "tone-key:wide",
      "tone-number:42",
      "tone-key:huge",
      "tone-number:1e+21",
      "tone-key:big",
      "tone-number:2n",
      "tone-key:ok",
      "tone-boolean:true",
      "tone-key:none",
      "tone-empty:null",
      "tone-key:when",
      "tone-date:Date(2024-01-02T03:04:05.000Z)",
      "tone-key:self",
      "tone-circular:[Circular]",
    ]);
  });

  it("leaves text that is not a value uncoloured", async () => {
    const devtools = await openFixedRow({ id: "plain", label: "not true, not 12", failure: new TypeError("bad: input") });

    const detail = devtools.ui.getByRole("region", { name: "Row detail" }).querySelector("pre");

    expect([...(detail?.querySelectorAll("span") ?? [])].map((span) => span.textContent)).toEqual([
      "id",
      '"plain"',
      "label",
      '"not true, not 12"',
      "failure",
    ]);
    expect(detail?.textContent).toBe(
      '{\n  id: "plain",\n  label: "not true, not 12",\n  failure: TypeError: bad: input\n}',
    );
  });

  it("shortens long binary values", async () => {
    const devtools = await openFixedRow({ id: "vector", embedding: new Float32Array(100).fill(0.5) });

    expect(detailText(devtools)).toContain(`embedding: Float32Array(100) [${Array(64).fill("0.5").join(", ")}, … 36 more]`);
  });

  it("previews values in table cells", async () => {
    const devtools = await openFixedRow({
      id: "cells",
      big: 7n,
      when: new Date("2024-01-02T03:04:05.000Z"),
      list: [1, 2],
      lookup: new Map([["a", 1]]),
      unique: new Set([1, 2, 3]),
      nested: { deep: true },
      nothing: null,
    });

    const cells = [...rowContaining(devtools, "cells").querySelectorAll("td")].map((cell) => cell.textContent);

    expect(cells).toEqual(["cells", "7n", "Date(2024-01-02T03:04:05.000Z)", "Array(2)", "Map(1)", "Set(3)", "{…}", "null"]);
  });

  it("colours table cells by the kind of value they hold", async () => {
    const devtools = await openFixedRow({
      id: "tones",
      count: 3,
      big: 4n,
      flag: false,
      when: new Date("2024-01-02T03:04:05.000Z"),
      nothing: null,
      missing: undefined,
      nested: { deep: true },
      marker: Symbol("tag"),
    });

    const tones = [...rowContaining(devtools, "tones").querySelectorAll("td")].map((cell) => cell.className);

    expect(tones).toEqual([
      "tone-string",
      "tone-number",
      "tone-number",
      "tone-boolean",
      "tone-date",
      "tone-empty",
      "tone-empty",
      "tone-complex",
      "tone-complex",
    ]);
  });

  it("renders a value that refers to itself as [Circular]", async () => {
    const node: { id: string; label: string; self?: object; children: object[] } = { id: "loop", label: "root", children: [] };
    node.self = node;
    node.children.push({ parent: node });

    const devtools = await openFixedRow(node);

    expect(detailText(devtools)).toBe(
      [
        "{",
        '  id: "loop",',
        '  label: "root",',
        "  children: [",
        "    {",
        "      parent: [Circular]",
        "    }",
        "  ],",
        "  self: [Circular]",
        "}",
      ].join("\n"),
    );
  });

  it("renders a value shared by two fields in full both times", async () => {
    const shared = { city: "Oslo" };

    const devtools = await openFixedRow({ id: "shared", home: shared, work: shared });

    expect(detailText(devtools)).toBe(
      ["{", '  id: "shared",', "  home: {", '    city: "Oslo"', "  },", "  work: {", '    city: "Oslo"', "  }", "}"].join("\n"),
    );
  });
});
