import { jest } from "@jest/globals";
import { act } from "preact/test-utils";

export interface ManualFrames {
  pending(): number;
  flush(): void;
  restore(): void;
}

export function manualFrames(): ManualFrames {
  let callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  const request = jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const id = nextId++;
    callbacks.set(id, callback);
    return id;
  });
  const cancel = jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    callbacks.delete(id);
  });

  return {
    pending: () => callbacks.size,
    flush: () =>
      act(() => {
        const due = [...callbacks.values()];
        callbacks = new Map();
        for (const callback of due) callback(performance.now());
      }),
    restore: () => {
      request.mockRestore();
      cancel.mockRestore();
    },
  };
}
