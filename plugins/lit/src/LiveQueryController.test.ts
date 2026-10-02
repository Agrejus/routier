import { describe, expect, it, jest } from "@jest/globals";
import type { ReactiveController, ReactiveControllerHost } from "lit";
import { Result, type LiveQuery, type ResultType } from "@routier/core/results";
import { LiveQueryController } from "./LiveQueryController";
import { addTodo, createLiveTodoStore, waitUntil, type LiveTodo } from "@routier/test-utils";

type Emit<T> = (result: ResultType<T>) => void;

class FakeHost implements ReactiveControllerHost {
  controllers: ReactiveController[] = [];
  requestUpdate = jest.fn();
  updateComplete = Promise.resolve(true);

  addController(controller: ReactiveController): void {
    this.controllers.push(controller);
  }

  removeController(controller: ReactiveController): void {
    this.controllers = this.controllers.filter((item) => item !== controller);
  }

  connect(): void {
    this.controllers.forEach((controller) => controller.hostConnected?.());
  }

  update(): void {
    this.controllers.forEach((controller) => controller.hostUpdate?.());
  }

  disconnect(): void {
    this.controllers.forEach((controller) => controller.hostDisconnected?.());
  }
}

function capture<T>() {
  const emits: Emit<T>[] = [];
  const stops: jest.Mock<() => void>[] = [];
  const query = jest.fn<LiveQuery<T>>((callback) => {
    emits.push(callback);
    const stop = jest.fn<() => void>();
    stops.push(stop);
    return stop;
  });
  return { emits, stops, query };
}

describe("LiveQueryController", () => {
  it("registers itself with the host and starts pending without querying", () => {
    const host = new FakeHost();
    const { query } = capture<string[]>();

    const controller = new LiveQueryController(host, { query });

    expect(host.controllers).toEqual([controller]);
    expect(controller.state.status).toBe("pending");
    expect(query).not.toHaveBeenCalled();
  });

  it("queries on connect and requests an update for each result", () => {
    const host = new FakeHost();
    const { emits, query } = capture<string[]>();
    const controller = new LiveQueryController(host, { query });

    host.connect();
    emits[0](Result.success(["a"]));
    emits[0](Result.success(["a", "b"]));

    expect(controller.state).toEqual({ status: "success", loading: false, data: ["a", "b"], isSuccess: true, isError: false });
    expect(host.requestUpdate).toHaveBeenCalledTimes(2);
  });

  it("reports an error with its message", () => {
    const host = new FakeHost();
    const controller = new LiveQueryController<string[]>(host, { query: (callback) => callback(Result.error(new Error("boom"))) });

    host.connect();

    expect(controller.state.status === "error" && controller.state.error.message).toBe("boom");
  });

  it("unsubscribes on disconnect and ignores later results", () => {
    const host = new FakeHost();
    const { emits, stops, query } = capture<string[]>();
    const controller = new LiveQueryController(host, { query });

    host.connect();
    host.disconnect();
    emits[0](Result.success(["late"]));

    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(controller.state.status).toBe("pending");
  });

  it("resubscribes pending when reconnected", () => {
    const host = new FakeHost();
    const { emits, query } = capture<string[]>();
    const controller = new LiveQueryController(host, { query });

    host.connect();
    emits[0](Result.success(["a"]));
    host.disconnect();
    host.connect();

    expect(query).toHaveBeenCalledTimes(2);
    expect(controller.state.status).toBe("pending");
  });

  it("does not requery on update when it has no args", () => {
    const host = new FakeHost();
    const { query } = capture<string[]>();
    new LiveQueryController(host, { query });

    host.connect();
    host.update();

    expect(query).toHaveBeenCalledTimes(1);
  });

  it("passes the args to the query", () => {
    const host = new FakeHost();
    const { query } = capture<string>();
    const build = jest.fn<(args: readonly [number]) => LiveQuery<string>>(() => query);
    new LiveQueryController(host, { args: () => [7] as const, query: build });

    host.connect();

    expect(build).toHaveBeenCalledWith([7]);
  });

  it("does not requery when the args are unchanged", () => {
    const host = new FakeHost();
    const { query } = capture<string>();
    let userId = 1;
    new LiveQueryController(host, { args: () => [userId, "x"] as const, query: () => query });

    host.connect();
    userId = 1;
    host.update();

    expect(query).toHaveBeenCalledTimes(1);
  });

  it("requeries and stops the previous query when an arg changes", () => {
    const host = new FakeHost();
    const { stops, query } = capture<string>();
    let userId = 1;
    const controller = new LiveQueryController(host, { args: () => [userId] as const, query: () => query });

    host.connect();
    userId = 2;
    host.update();

    expect(query).toHaveBeenCalledTimes(2);
    expect(stops[0]).toHaveBeenCalledTimes(1);
    expect(controller.state.status).toBe("pending");
  });

  it("requeries when one of several args changes", () => {
    const host = new FakeHost();
    const { query } = capture<string>();
    let userId = 1;
    new LiveQueryController(host, { args: () => [userId, "x"] as const, query: () => query });

    host.connect();
    userId = 2;
    host.update();

    expect(query).toHaveBeenCalledTimes(2);
  });

  it("does nothing on an update before it is connected", () => {
    const host = new FakeHost();
    const { query } = capture<string>();
    new LiveQueryController(host, { args: () => [1] as const, query: () => query });

    host.update();

    expect(query).not.toHaveBeenCalled();
  });

  it("does not resubscribe on an update after it is disconnected", () => {
    const host = new FakeHost();
    const { query } = capture<string>();
    let userId = 1;
    new LiveQueryController(host, { args: () => [userId] as const, query: () => query });

    host.connect();
    host.disconnect();
    userId = 2;
    host.update();

    expect(query).toHaveBeenCalledTimes(1);
  });

  it("requeries when the number of args changes", () => {
    const host = new FakeHost();
    const { query } = capture<string>();
    let args: readonly number[] = [1];
    new LiveQueryController(host, { args: () => args, query: () => query });

    host.connect();
    args = [1, 2];
    host.update();

    expect(query).toHaveBeenCalledTimes(2);
  });
});

describe("LiveQueryController with a real store", () => {
  it("follows adds to a collection", async () => {
    const store = createLiveTodoStore();
    const host = new FakeHost();
    const controller = new LiveQueryController<LiveTodo[]>(host, { query: (callback) => store.todos.subscribe().toArray(callback) });

    host.connect();
    await addTodo(store, "a");
    await waitUntil(() => controller.state.status === "success" && controller.state.data.map((todo) => todo.title).join() === "a");

    host.disconnect();
    await store.destroyAsync();
  });
});
