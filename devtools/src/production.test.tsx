import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "preact/test-utils";
import type { UnmountDevtools } from "@routier/devtools";
import { createShopStore, disposeStores } from "../test/stores";

type MountModule = typeof import("@routier/devtools");

const originalNodeEnv = process.env.NODE_ENV;
const cleanups: UnmountDevtools[] = [];

afterEach(() => {
  for (const unmount of cleanups.splice(0)) act(() => unmount());
  process.env.NODE_ENV = originalNodeEnv;
  disposeStores();
  jest.restoreAllMocks();
});

async function loadWith(nodeEnv: string, entry: () => Promise<MountModule>): Promise<MountModule> {
  process.env.NODE_ENV = nodeEnv;
  let loaded: MountModule | null = null;
  await jest.isolateModulesAsync(async () => {
    loaded = await entry();
  });
  if (loaded === null) throw new Error("module did not load");
  return loaded;
}

function mountWith(module: MountModule) {
  const store = createShopStore();
  const inspect = jest.spyOn(store, "inspect");
  let unmount: UnmountDevtools = () => undefined;
  act(() => {
    unmount = module.mountRoutierDevtools(store);
  });
  cleanups.push(unmount);
  return { inspect, unmount, host: document.querySelector("[data-routier-devtools]") };
}

describe("the main entry", () => {
  it("does nothing in production", async () => {
    const devtools = await loadWith("production", () => import("@routier/devtools"));

    const { inspect, unmount, host } = mountWith(devtools);

    expect(host).toBeNull();
    expect(inspect).not.toHaveBeenCalled();
    expect(() => unmount()).not.toThrow();
  });

  it("mounts the drawer outside production", async () => {
    const devtools = await loadWith("development", () => import("@routier/devtools"));

    const { inspect, host } = mountWith(devtools);

    expect(host).not.toBeNull();
    expect(inspect).toHaveBeenCalledTimes(1);
  });
});

describe("the production entry", () => {
  it("mounts the drawer even in production", async () => {
    const devtools = await loadWith("production", () => import("@routier/devtools/production"));

    const { inspect, host } = mountWith(devtools);

    expect(host).not.toBeNull();
    expect(inspect).toHaveBeenCalledTimes(1);
  });
});
