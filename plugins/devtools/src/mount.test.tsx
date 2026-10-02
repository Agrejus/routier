import { afterEach, describe, expect, it } from "@jest/globals";
import { fireEvent } from "@testing-library/dom";
import { fakeCollection, fakeStore } from "../tests/fakeCollections";
import { createEmptyStore, createShopStore, disposeStores } from "../tests/stores";
import { interact, mount, type MountedDevtools } from "../tests/harness";

const mounted: MountedDevtools[] = [];

function mountShop(): MountedDevtools {
  const devtools = mount(createShopStore());
  mounted.push(devtools);
  return devtools;
}

afterEach(() => {
  for (const devtools of mounted.splice(0)) devtools.unmount();
  disposeStores();
  document.head.innerHTML = "";
});

describe("mountRoutierDevtools host", () => {
  it("adds exactly one host element with an open shadow root", () => {
    const { host } = mountShop();

    expect(document.querySelectorAll("[data-routier-devtools]")).toHaveLength(1);
    expect(host.getAttribute("data-routier-devtools")).toBe("");
    expect(host.shadowRoot).not.toBeNull();
  });

  it("keeps its styles inside the shadow root and out of the document", () => {
    const { shadow } = mountShop();

    expect(document.querySelectorAll("style")).toHaveLength(0);
    expect(shadow.querySelector("style")?.textContent).toContain(":host");
  });

  it("resets inherited styles at the host so the app cannot style the drawer", () => {
    const { shadow } = mountShop();

    expect(shadow.querySelector("style")?.textContent).toMatch(/:host\s*{\s*all: initial;/);
    expect(shadow.querySelector("style")?.textContent).toMatch(/\.launcher \{[\s\S]*\.browser \{[\s\S]*\.queries \{/);
  });

  it("cannot be reached by the app's selectors", () => {
    const { toggle } = mountShop();
    toggle();

    expect(document.querySelector(".drawer")).toBeNull();
    expect(document.querySelector("button")).toBeNull();
  });
});

describe("toggle button", () => {
  it("starts closed", () => {
    const { ui } = mountShop();

    expect(ui.getByRole("button", { name: "Open Routier devtools" }).getAttribute("aria-expanded")).toBe("false");
    expect(ui.queryByRole("complementary", { name: "Routier devtools" })).toBeNull();
  });

  it("shows the Routier logo with a debug badge on the launcher", () => {
    const { ui } = mountShop();
    const launcher = ui.getByRole("button", { name: "Open Routier devtools" });

    expect(launcher.querySelector("svg mask")).not.toBeNull();
    expect(launcher.querySelector(".launcher-badge svg")).not.toBeNull();
    expect(launcher.getAttribute("title")).toBe("Open Routier devtools");
  });

  it("draws a complete logo whose gradients and mask all resolve", () => {
    const { shadow } = mountShop();
    const logo = shadow.querySelector(".launcher svg");
    const defined = [...(logo?.querySelectorAll("linearGradient, mask") ?? [])].map((element) => element.id);
    const referenced = [...(logo?.querySelectorAll("[fill^='url'], [mask]") ?? [])].map((element) =>
      (element.getAttribute("fill") ?? element.getAttribute("mask") ?? "").replace(/^url\(#(.*)\)$/, "$1"),
    );

    expect(defined).toHaveLength(3);
    expect(defined.every((id) => id.length > 0)).toBe(true);
    expect([...new Set(referenced)].sort()).toEqual([...defined].sort());
    expect([...(logo?.querySelectorAll("path") ?? [])].every((path) => (path.getAttribute("d") ?? "").length > 0)).toBe(true);
  });

  it("hides the launcher while the drawer is open and brands the drawer header", () => {
    const { ui, toggle } = mountShop();

    toggle();

    expect(ui.queryByRole("button", { name: "Open Routier devtools" })).toBeNull();
    expect(ui.getByRole("complementary", { name: "Routier devtools" }).querySelector(".brand")?.textContent).toBe(
      "RoutierDevtools",
    );
  });

  it("opens the drawer", () => {
    const { ui, toggle } = mountShop();

    toggle();

    expect(ui.getByRole("complementary", { name: "Routier devtools" })).toBeTruthy();
    expect(ui.getByRole("button", { name: "Close Routier devtools" }).getAttribute("aria-expanded")).toBe("true");
    expect(ui.getByRole("button", { name: "Close Routier devtools" }).querySelector("svg path")).not.toBeNull();
  });

  it("closes the drawer again", () => {
    const { ui, toggle } = mountShop();

    toggle();
    toggle();

    expect(ui.queryByRole("complementary", { name: "Routier devtools" })).toBeNull();
    expect(ui.getByRole("button", { name: "Open Routier devtools" })).toBeTruthy();
  });
});

describe("drawer resizing", () => {
  function openDrawer() {
    const devtools = mountShop();
    devtools.toggle();
    const drawer = devtools.ui.getByRole("complementary", { name: "Routier devtools" });
    const handle = devtools.ui.getByRole("separator", { name: "Resize Routier devtools" });
    const overlay = () => devtools.shadow.querySelector(".drag-overlay");
    return { devtools, drawer, handle, overlay };
  }

  function overlayOf(drawer: HTMLElement): HTMLElement {
    const overlay = drawer.querySelector<HTMLElement>(".drag-overlay");
    if (overlay === null) throw new Error("no drag overlay");
    return overlay;
  }

  function drag(handle: HTMLElement, fromY: number, toY: number) {
    const drawer = handle.closest("aside");
    if (drawer === null) throw new Error("handle is outside the drawer");
    interact(() => {
      fireEvent.mouseDown(handle, { clientY: fromY });
    });
    interact(() => {
      fireEvent.mouseMove(overlayOf(drawer), { clientY: toY });
      fireEvent.mouseUp(overlayOf(drawer), { clientY: toY });
    });
  }

  it("opens at its initial height", () => {
    const { drawer, handle } = openDrawer();

    expect(drawer.style.height).toBe("320px");
    expect(handle.getAttribute("aria-valuenow")).toBe("320");
    expect(handle.getAttribute("aria-valuemin")).toBe("120");
    expect(handle.getAttribute("aria-valuemax")).toBe(String(Math.round(window.innerHeight * 0.9)));
  });

  it("grows when the handle is dragged up", () => {
    const { drawer, handle } = openDrawer();

    drag(handle, 500, 400);

    expect(drawer.style.height).toBe("420px");
  });

  it("shrinks when the handle is dragged down", () => {
    const { drawer, handle } = openDrawer();

    drag(handle, 400, 500);

    expect(drawer.style.height).toBe("220px");
  });

  it("covers the page while dragging so the drag survives leaving the handle", () => {
    const { handle, overlay } = openDrawer();

    expect(overlay()).toBeNull();
    interact(() => {
      fireEvent.mouseDown(handle, { clientY: 500 });
    });

    expect(overlay()).not.toBeNull();
  });

  it("stops the browser selecting text when a drag starts", () => {
    const { handle } = openDrawer();
    let allowed = true;

    interact(() => {
      allowed = fireEvent.mouseDown(handle, { clientY: 500 });
    });

    expect(allowed).toBe(false);
  });

  it("stops following the mouse once it is released", () => {
    const { drawer, handle, overlay } = openDrawer();
    drag(handle, 500, 450);

    expect(overlay()).toBeNull();
    expect(drawer.style.height).toBe("370px");
  });

  it("never shrinks below the minimum height", () => {
    const { drawer, handle } = openDrawer();

    drag(handle, 100, 700);

    expect(drawer.style.height).toBe("120px");
  });

  it("never grows past most of the viewport", () => {
    const { drawer, handle } = openDrawer();

    drag(handle, 700, -5000);

    expect(drawer.style.height).toBe(`${Math.round(window.innerHeight * 0.9)}px`);
  });

  it("resizes with the arrow keys", () => {
    const { drawer, handle } = openDrawer();

    interact(() => {
      fireEvent.keyDown(handle, { key: "ArrowUp" });
    });
    expect(drawer.style.height).toBe("340px");

    interact(() => {
      fireEvent.keyDown(handle, { key: "ArrowDown" });
      fireEvent.keyDown(handle, { key: "ArrowDown" });
    });
    expect(drawer.style.height).toBe("300px");
  });

  it("claims the arrow keys it uses", () => {
    const { handle } = openDrawer();
    let allowed = true;

    interact(() => {
      allowed = fireEvent.keyDown(handle, { key: "ArrowUp" });
    });

    expect(allowed).toBe(false);
  });

  it("ignores other keys", () => {
    const { drawer, handle } = openDrawer();
    let allowed = false;

    interact(() => {
      allowed = fireEvent.keyDown(handle, { key: "Enter" });
    });

    expect(allowed).toBe(true);
    expect(drawer.style.height).toBe("320px");
    expect(handle.getAttribute("aria-valuenow")).toBe("320");
  });

  it("ends a drag when the drawer closes mid-drag", () => {
    const { devtools, handle, overlay } = openDrawer();
    interact(() => {
      fireEvent.mouseDown(handle, { clientY: 500 });
    });

    devtools.toggle();
    devtools.toggle();

    expect(overlay()).toBeNull();
    expect(devtools.ui.getByRole("complementary", { name: "Routier devtools" }).style.height).toBe("320px");
  });
});

describe("collection list", () => {
  function openShop() {
    const devtools = mountShop();
    devtools.toggle();
    return devtools.ui;
  }

  it("lists the store's collections", () => {
    const ui = openShop();
    const section = ui.getByRole("region", { name: "Collections" });

    expect([...section.querySelectorAll(".collection-name")].map((item) => item.textContent)).toEqual([
      "products",
      "orders",
    ]);
  });

  it("lists views in their own section, labelled as views", () => {
    const ui = openShop();
    const section = ui.getByRole("region", { name: "Views" });

    expect(section.querySelector("h2")?.textContent).toBe("Views");
    expect([...section.querySelectorAll(".collection-name")].map((item) => item.textContent)).toEqual(["productNames"]);
    expect(section.querySelector(".collection-item .kind-badge")?.textContent).toBe("view");
  });

  it("does not label collections as views", () => {
    const ui = openShop();

    expect(ui.getByRole("region", { name: "Collections" }).querySelector(".kind-badge")).toBeNull();
  });

  it("omits the views section for a store without views", () => {
    const devtools = mount(fakeStore(fakeCollection("only")));
    mounted.push(devtools);
    devtools.toggle();

    expect(devtools.ui.getByRole("region", { name: "Collections" })).toBeTruthy();
    expect(devtools.ui.queryByRole("region", { name: "Views" })).toBeNull();
  });

  it("omits both sections for a store with nothing in it", () => {
    const devtools = mount(createEmptyStore());
    mounted.push(devtools);
    devtools.toggle();

    expect(devtools.ui.queryByRole("region", { name: "Collections" })).toBeNull();
    expect(devtools.ui.queryByRole("region", { name: "Views" })).toBeNull();
  });
});

describe("unmount", () => {
  it("removes the host element", () => {
    const devtools = mount(createShopStore());

    devtools.unmount();

    expect(document.querySelector("[data-routier-devtools]")).toBeNull();
  });
});
