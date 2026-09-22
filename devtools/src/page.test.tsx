import { afterEach, describe, expect, it } from "@jest/globals";
import { fireEvent, within } from "@testing-library/dom";
import { act } from "preact/test-utils";
import { mountRoutierDevtools, type UnmountDevtools } from "@routier/devtools";
import { createShopStore, disposeStores } from "../test/stores";

const cleanups: UnmountDevtools[] = [];

afterEach(() => {
  for (const unmount of cleanups.splice(0).reverse()) act(() => unmount());
  disposeStores();
});

function mountPage(): UnmountDevtools {
  let unmount: UnmountDevtools = () => undefined;
  act(() => {
    unmount = mountRoutierDevtools();
  });
  cleanups.push(unmount);
  return unmount;
}

function mountStore(): UnmountDevtools {
  let unmount: UnmountDevtools = () => undefined;
  act(() => {
    unmount = mountRoutierDevtools(createShopStore());
  });
  cleanups.push(unmount);
  return unmount;
}

function hosts(): NodeListOf<HTMLElement> {
  return document.querySelectorAll<HTMLElement>("[data-routier-devtools]");
}

function ui() {
  const container = hosts()[0]?.shadowRoot?.querySelector<HTMLElement>(".routier-devtools");
  if (container == null) throw new Error("devtools are not mounted");
  return within(container);
}

function openDrawer() {
  act(() => {
    fireEvent.click(ui().getByRole("button", { name: "Open Routier devtools" }));
  });
}

describe("mounting devtools without a store", () => {
  it("shows the launcher straight away", () => {
    mountPage();

    expect(hosts()).toHaveLength(1);
    expect(ui().getByRole("button", { name: "Open Routier devtools" })).toBeTruthy();
  });

  it("says no store is mounted yet", () => {
    mountPage();
    openDrawer();

    expect(ui().getByRole("status").textContent).toBe(
      "No stores yet. Each store appears here once your app mounts it with mountRoutierDevtools(store).",
    );
    expect(ui().queryByLabelText("Storage")).toBeNull();
  });

  it("shows a store that is mounted later", () => {
    mountPage();
    openDrawer();

    mountStore();

    expect(ui().getByRole("button", { name: /^products/ })).toBeTruthy();
    expect(ui().getByLabelText("Storage")).toBeTruthy();
  });

  it("keeps the launcher when the last store is unmounted", () => {
    mountPage();
    const unmountStore = mountStore();

    act(() => unmountStore());

    expect(hosts()).toHaveLength(1);
  });

  it("removes everything once the page mount and every store are gone", () => {
    const unmountPage = mountPage();
    const unmountStore = mountStore();

    act(() => unmountPage());
    expect(hosts()).toHaveLength(1);

    act(() => unmountStore());
    expect(hosts()).toHaveLength(0);
  });

  it("removes the launcher when the page mount is undone and no store is mounted", () => {
    const unmountPage = mountPage();

    act(() => unmountPage());

    expect(hosts()).toHaveLength(0);
  });

  it("does nothing the second time and hands back the same unmount", () => {
    const first = mountPage();
    const second = mountPage();

    expect(second).toBe(first);
    expect(hosts()).toHaveLength(1);
  });

  it("ignores an unmount that was already used", () => {
    const stale = mountPage();
    act(() => stale());
    const fresh = mountPage();

    act(() => stale());
    const unmountStore = mountStore();
    expect(hosts()).toHaveLength(1);
    act(() => unmountStore());

    expect(hosts()).toHaveLength(1);
    act(() => fresh());
    expect(hosts()).toHaveLength(0);
  });
});
