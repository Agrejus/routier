import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { logger } from "@routier/core/utilities";
import { mountRoutierDevtools } from "@routier/devtools";
import { createShopStore, disposeStores } from "../tests/stores";

afterEach(() => {
  Reflect.deleteProperty(globalThis, "document");
  disposeStores();
  jest.restoreAllMocks();
});

describe("mountRoutierDevtools without a document", () => {
  it("runs in an environment with no document", () => {
    expect(typeof document).toBe("undefined");
  });

  it("does nothing, logs nothing, and returns an unmount that does nothing", () => {
    const logged = jest.spyOn(logger, "error");
    const store = createShopStore();
    const inspect = jest.spyOn(store, "inspect");

    const unmount = mountRoutierDevtools(store);

    expect(() => unmount()).not.toThrow();
    expect(inspect).not.toHaveBeenCalled();
    expect(logged).not.toHaveBeenCalled();
  });

  it("goes on to mount once a document exists", () => {
    const logged = jest.spyOn(logger, "error").mockImplementation(() => undefined);
    Reflect.defineProperty(globalThis, "document", { value: {}, configurable: true });
    const store = createShopStore();
    const inspect = jest.spyOn(store, "inspect");

    mountRoutierDevtools(store);

    expect(inspect).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledWith("[routier-devtools] mount", expect.any(TypeError));
  });
});
