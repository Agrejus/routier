import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryObserver } from "@tanstack/query-core";
import { Result, type LiveQuery, type ResultType } from "@routier/core/results";
import { liveQueryOptions } from "./liveQueryOptions";
import { addTodo, createLiveTodoStore, waitUntil, type LiveTodo } from "@routier/test-utils";

type Emit<T> = (result: ResultType<T>) => void;

function capture<T>() {
    const emits: Emit<T>[] = [];
    const stops: jest.Mock<() => void>[] = [];
    const query = jest.fn<LiveQuery<T>>((callback) => {
        emits.push(callback);
        const stop = jest.fn<() => void>();
        stops.push(stop);
        return stop;
    });
    const latest = () => emits[emits.length - 1];
    return { emits, stops, query, latest };
}

const clients: QueryClient[] = [];

const newClient = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    clients.push(client);
    return client;
};

afterEach(() => {
    clients.splice(0).forEach((client) => client.clear());
});

describe("liveQueryOptions", () => {
    it("carries the query key and never goes stale", () => {
        const options = liveQueryOptions({ queryKey: ["users"], query: () => undefined });

        expect(options.queryKey).toEqual(["users"]);
        expect(options.staleTime).toBe(Infinity);
    });

    it("resolves with the first result", async () => {
        const client = newClient();
        const { query, latest } = capture<string[]>();

        const fetched = client.fetchQuery(liveQueryOptions({ queryKey: ["users"], query }));
        latest()(Result.success(["a"]));

        await expect(fetched).resolves.toEqual(["a"]);
    });

    it("rejects when the first result is an error", async () => {
        const client = newClient();
        const { query, latest } = capture<string[]>();

        const fetched = client.fetchQuery(liveQueryOptions({ queryKey: ["users"], query }));
        latest()(Result.error(new Error("boom")));

        await expect(fetched).rejects.toThrow("boom");
    });

    it("pushes later results into the cache", async () => {
        const client = newClient();
        const { query, latest } = capture<string[]>();

        const fetched = client.fetchQuery(liveQueryOptions({ queryKey: ["users"], query }));
        latest()(Result.success(["a"]));
        await fetched;
        latest()(Result.success(["a", "b"]));

        expect(client.getQueryData(["users"])).toEqual(["a", "b"]);
    });

    it("refetches through the query function when a later result is an error", async () => {
        const client = newClient();
        const { query, latest } = capture<string[]>();
        const observer = new QueryObserver(client, liveQueryOptions({ queryKey: ["users"], query }));
        const stopObserving = observer.subscribe(() => undefined);

        latest()(Result.success(["a"]));
        await client.getQueryCache().find({ queryKey: ["users"] })?.promise;
        latest()(Result.error(new Error("later")));

        expect(query).toHaveBeenCalledTimes(2);
        stopObserving();
    });

    it("refetches only the query whose later result was an error", async () => {
        const client = newClient();
        const users = capture<string[]>();
        const user = capture<string[]>();
        const stopUsers = new QueryObserver(client, liveQueryOptions({ queryKey: ["users"], query: users.query })).subscribe(() => undefined);
        const stopUser = new QueryObserver(client, liveQueryOptions({ queryKey: ["users", 1], query: user.query })).subscribe(() => undefined);

        users.latest()(Result.success(["a"]));
        user.latest()(Result.success(["one"]));
        await Promise.all([["users"], ["users", 1]].map((queryKey) => client.getQueryCache().find({ queryKey, exact: true })?.promise));
        users.latest()(Result.error(new Error("later")));

        expect(users.query).toHaveBeenCalledTimes(2);
        expect(user.query).toHaveBeenCalledTimes(1);
        stopUsers();
        stopUser();
    });

    it("stops the previous subscription when the query function runs again", async () => {
        const client = newClient();
        const { query, latest, stops } = capture<string[]>();
        const options = liveQueryOptions({ queryKey: ["users"], query });

        const first = client.fetchQuery(options);
        latest()(Result.success(["a"]));
        await first;
        const second = client.fetchQuery({ ...options, staleTime: 0 });
        latest()(Result.success(["b"]));
        await second;

        expect(stops[0]).toHaveBeenCalledTimes(1);
        expect(stops[1]).not.toHaveBeenCalled();
    });

    it("keeps separate subscriptions for separate keys", async () => {
        const client = newClient();
        const users = capture<string[]>();
        const posts = capture<string[]>();

        const a = client.fetchQuery(liveQueryOptions({ queryKey: ["users"], query: users.query }));
        const b = client.fetchQuery(liveQueryOptions({ queryKey: ["posts"], query: posts.query }));
        users.latest()(Result.success(["u"]));
        posts.latest()(Result.success(["p"]));
        await Promise.all([a, b]);

        expect(users.stops[0]).not.toHaveBeenCalled();
        expect(posts.stops[0]).not.toHaveBeenCalled();
    });

    it("stops the subscription when the query leaves the cache", async () => {
        const client = newClient();
        const { query, latest, stops } = capture<string[]>();

        const fetched = client.fetchQuery(liveQueryOptions({ queryKey: ["users"], query }));
        latest()(Result.success(["a"]));
        await fetched;
        client.removeQueries({ queryKey: ["users"] });

        expect(stops[0]).toHaveBeenCalledTimes(1);
    });

    it("ignores other cache events", async () => {
        const client = newClient();
        const { query, latest, stops } = capture<string[]>();

        const fetched = client.fetchQuery(liveQueryOptions({ queryKey: ["users"], query }));
        latest()(Result.success(["a"]));
        await fetched;
        client.setQueryData(["users"], ["manual"]);

        expect(stops[0]).not.toHaveBeenCalled();
    });

    it("stops subscriptions on every client that holds them", async () => {
        const first = newClient();
        const second = newClient();
        const one = capture<string[]>();
        const two = capture<string[]>();

        const a = first.fetchQuery(liveQueryOptions({ queryKey: ["users"], query: one.query }));
        const b = second.fetchQuery(liveQueryOptions({ queryKey: ["users"], query: two.query }));
        one.latest()(Result.success(["a"]));
        two.latest()(Result.success(["b"]));
        await Promise.all([a, b]);
        first.removeQueries({ queryKey: ["users"] });

        expect(one.stops[0]).toHaveBeenCalledTimes(1);
        expect(two.stops[0]).not.toHaveBeenCalled();
    });
});

describe("liveQueryOptions with a real store", () => {
  it("pushes adds to a collection into the cache", async () => {
    const store = createLiveTodoStore();
    const client = newClient();

    const query: LiveQuery<LiveTodo[]> = (callback) => store.todos.subscribe().toArray(callback);

    await addTodo(store, "a");
    await client.fetchQuery(liveQueryOptions({ queryKey: ["todos"], query }));
    await addTodo(store, "b");
    await waitUntil(() => (client.getQueryData<LiveTodo[]>(["todos"]) ?? []).map((todo) => todo.title).sort().join() === "a,b");

    await store.destroyAsync();
  });
});
