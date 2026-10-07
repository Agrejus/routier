import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { SchemaSubscription } from "./broadcast";

type MessageEventLike = {
    data: unknown;
};

class MockBroadcastChannel {
    static channels = new Map<string, Set<MockBroadcastChannel>>();
    readonly name: string;
    onmessage: ((event: MessageEventLike) => void) | null = null;

    constructor(name: string) {
        this.name = name;
        if (!MockBroadcastChannel.channels.has(name)) {
            MockBroadcastChannel.channels.set(name, new Set());
        }
        MockBroadcastChannel.channels.get(name)!.add(this);
    }

    postMessage(data: unknown) {
        const channels = MockBroadcastChannel.channels.get(this.name);
        if (channels == null) {
            return;
        }

        for (const channel of channels) {
            if (channel === this) {
                continue;
            }
            channel.onmessage?.({ data });
        }
    }

    close() {
        MockBroadcastChannel.channels.get(this.name)?.delete(this);
    }
}

// A compiled schema always exposes both halves of the wire pipeline: `preprocess`
// (prepare + serialize) on send and `postprocess` (deserialize + enrich) on receive.
// Mocks must carry both, or a receive-path regression looks like a passing test.
const mockSchema = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    preprocess: (x: unknown) => x,
    postprocess: (x: unknown) => x,
    ...overrides,
}) as any;

describe("SchemaSubscription broadcast contract", () => {
    const originalBroadcastChannel = globalThis.BroadcastChannel;

    beforeEach(() => {
        (globalThis as any).BroadcastChannel = MockBroadcastChannel;
        MockBroadcastChannel.channels.clear();
    });

    afterEach(() => {
        (globalThis as any).BroadcastChannel = originalBroadcastChannel;
        MockBroadcastChannel.channels.clear();
    });

    it("does not deliver messages after subscription is disposed", () => {
        const schema = mockSchema("schema-1");

        const sender = new SchemaSubscription(schema);
        const receiver = new SchemaSubscription(schema);
        const callback = jest.fn();
        receiver.onMessage(callback);
        receiver.dispose();

        sender.send({
            adds: [{ id: 1 }],
            updates: [],
            removals: [],
            unknown: [],
        } as any);

        expect(callback).not.toHaveBeenCalled();
    });

    it("dispose is idempotent and remains unsubscribed", () => {
        const schema = mockSchema("schema-idempotent");

        const sender = new SchemaSubscription(schema);
        const receiver = new SchemaSubscription(schema);
        const callback = jest.fn();

        receiver.onMessage(callback);
        receiver.dispose();
        receiver.dispose();

        sender.send({
            adds: [{ id: 1 }],
            updates: [],
            removals: [],
            unknown: [],
        } as any);

        expect(callback).not.toHaveBeenCalled();
    });

    it("isolates channels by schema id", () => {
        const schemaA = mockSchema("schema-A");
        const schemaB = mockSchema("schema-B");

        const senderA = new SchemaSubscription(schemaA);
        const receiverB = new SchemaSubscription(schemaB);
        const callback = jest.fn();
        receiverB.onMessage(callback);

        senderA.send({
            adds: [{ id: 1 }],
            updates: [],
            removals: [],
            unknown: [],
        } as any);

        expect(callback).not.toHaveBeenCalled();
    });

    it("fans out to multiple listeners for same schema channel", () => {
        const schema = mockSchema("schema-fanout");

        const sender = new SchemaSubscription(schema);
        const receiverA = new SchemaSubscription(schema);
        const receiverB = new SchemaSubscription(schema);
        const callbackA = jest.fn();
        const callbackB = jest.fn();
        receiverA.onMessage(callbackA);
        receiverB.onMessage(callbackB);

        sender.send({
            adds: [{ id: 1 }],
            updates: [],
            removals: [],
            unknown: [],
        } as any);

        expect(callbackA).toHaveBeenCalledTimes(1);
        expect(callbackB).toHaveBeenCalledTimes(1);
    });

    it("should postprocess incoming changes before delivering to listeners", () => {
        const preprocess = jest.fn((x: any) => ({ ...x, _stage: "pre" }));
        const postprocess = jest.fn((x: any) => ({ ...x, _stage: "post" }));
        const schema = mockSchema("schema-postprocess", { preprocess, postprocess });

        const sender = new SchemaSubscription(schema);
        const receiver = new SchemaSubscription(schema);
        const callback = jest.fn();
        receiver.onMessage(callback);

        sender.send({
            adds: [{ id: 1 }],
            updates: [],
            removals: [],
            unknown: [],
        } as any);

        expect(callback).toHaveBeenCalledTimes(1);
        const message = callback.mock.calls[0][0] as any;
        expect(postprocess).toHaveBeenCalled();
        expect(message.adds[0]._stage).toBe("post");
    });

    it("delivers exactly the sent changes of every kind, each preprocessed and then postprocessed", () => {
        const preprocess = (x: { id: number }) => ({ wire: x.id });
        const modes: string[] = [];
        const postprocess = (x: { wire: number }, mode: string) => {
            modes.push(mode);
            return { id: x.wire, received: true };
        };
        const schema = mockSchema("schema-every-kind", { preprocess, postprocess });

        const sender = new SchemaSubscription(schema);
        const receiver = new SchemaSubscription(schema);
        const callback = jest.fn();
        receiver.onMessage(callback);

        sender.send({
            adds: [{ id: 1 }, { id: 2 }],
            removals: [{ id: 3 }],
            unknown: [{ id: 4 }],
            updates: [{ id: 5 }],
        } as any);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback.mock.calls[0][0]).toEqual({
            adds: [{ id: 1, received: true }, { id: 2, received: true }],
            removals: [{ id: 3, received: true }],
            unknown: [{ id: 4, received: true }],
            updates: [{ id: 5, received: true }],
        });
        expect(modes).toEqual(["diff", "diff", "diff", "diff", "diff"]);
    });

    it("delivers empty kinds as empty arrays", () => {
        const schema = mockSchema("schema-empty-kinds");

        const sender = new SchemaSubscription(schema);
        const receiver = new SchemaSubscription(schema);
        const callback = jest.fn();
        receiver.onMessage(callback);

        sender.send({ adds: [], removals: [], unknown: [], updates: [] } as any);

        expect(callback.mock.calls[0][0]).toEqual({ adds: [], removals: [], unknown: [], updates: [] });
    });

    describe("crossTabSync", () => {

        it("preprocesses and sends with no listeners by default, because another tab may be listening", () => {
            const preprocess = jest.fn((x: any) => x);
            const schema = mockSchema("schema-default-sends", { preprocess });

            const sender = new SchemaSubscription(schema);

            sender.send({
                adds: [{ id: 1 }],
                updates: [],
                removals: [],
                unknown: [],
            } as any);

            expect(preprocess).toHaveBeenCalledTimes(1);
        });

        it("skips preprocessing entirely when crossTabSync is off and nothing is listening", () => {
            const preprocess = jest.fn((x: any) => x);
            const schema = mockSchema("schema-guarded", { preprocess });

            const sender = new SchemaSubscription(schema, undefined, undefined, { crossTabSync: false });

            sender.send({
                adds: [{ id: 1 }],
                updates: [{ id: 2 }],
                removals: [{ id: 3 }],
                unknown: [{ id: 4 }],
            } as any);

            expect(preprocess).not.toHaveBeenCalled();
        });

        it("still delivers to a local listener when crossTabSync is off", () => {
            const schema = mockSchema("schema-guarded-local");

            const sender = new SchemaSubscription(schema, undefined, undefined, { crossTabSync: false });
            const receiver = new SchemaSubscription(schema);
            const callback = jest.fn();
            receiver.onMessage(callback);

            sender.send({
                adds: [{ id: 1 }],
                updates: [],
                removals: [],
                unknown: [],
            } as any);

            expect(callback).toHaveBeenCalledTimes(1);
        });

        // The count that matters is registered CALLBACKS, not subscription objects. A DataStore
        // builds one subscription per collection just to send from, so a count of instances is
        // never zero and the guard below would never engage.
        it("counts listeners rather than subscriptions, so a sender-only peer does not defeat the guard", () => {
            const preprocess = jest.fn((x: any) => x);
            const schema = mockSchema("schema-sender-only-peer", { preprocess });

            const sender = new SchemaSubscription(schema, undefined, undefined, { crossTabSync: false });
            // Exists, retains the channel, but never calls onMessage.
            new SchemaSubscription(schema);

            sender.send({
                adds: [{ id: 1 }],
                updates: [],
                removals: [],
                unknown: [],
            } as any);

            expect(preprocess).not.toHaveBeenCalled();
        });

        it("resumes sending when a listener arrives and stops again once it disposes", () => {
            const preprocess = jest.fn((x: any) => x);
            const schema = mockSchema("schema-guard-toggles", { preprocess });

            const sender = new SchemaSubscription(schema, undefined, undefined, { crossTabSync: false });
            const changes = { adds: [{ id: 1 }], updates: [], removals: [], unknown: [] } as any;

            sender.send(changes);
            expect(preprocess).not.toHaveBeenCalled();

            const receiver = new SchemaSubscription(schema);
            receiver.onMessage(jest.fn());

            sender.send(changes);
            expect(preprocess).toHaveBeenCalledTimes(1);

            receiver.dispose();

            sender.send(changes);
            expect(preprocess).toHaveBeenCalledTimes(1);
        });

        it("scopes the guard per channel, so a listener on one scope does not unblock another", () => {
            const preprocess = jest.fn((x: any) => x);
            const schema = mockSchema("schema-scoped-guard", { preprocess });

            const listenedTo = new SchemaSubscription(schema, undefined, "db-a");
            listenedTo.onMessage(jest.fn());

            const sender = new SchemaSubscription(schema, undefined, "db-b", { crossTabSync: false });

            sender.send({
                adds: [{ id: 1 }],
                updates: [],
                removals: [],
                unknown: [],
            } as any);

            expect(preprocess).not.toHaveBeenCalled();
        });
    });

    it("should restore Date values on receive via postprocess", () => {
        const preprocess = jest.fn((x: any) => {
            if (x && x.createdAt instanceof Date) {
                return { ...x, createdAt: x.createdAt.toISOString() };
            }
            return x;
        });
        const postprocess = jest.fn((x: any) => {
            if (x && typeof x.createdAt === "string") {
                return { ...x, createdAt: new Date(x.createdAt) };
            }
            return x;
        });
        const schema = mockSchema("schema-date-roundtrip", { preprocess, postprocess });

        const sender = new SchemaSubscription(schema);
        const receiver = new SchemaSubscription(schema);
        const callback = jest.fn();
        receiver.onMessage(callback);

        sender.send({
            adds: [{ id: "1", createdAt: new Date("2026-01-01T00:00:00.000Z") }],
            updates: [],
            removals: [],
            unknown: [],
        } as any);

        expect(callback).toHaveBeenCalledTimes(1);
        const payload = callback.mock.calls[0][0] as any;
        expect(payload.adds[0].createdAt).toBeInstanceOf(Date);
    });
});

describe("SchemaSubscription without BroadcastChannel", () => {
    const originalBroadcastChannel = globalThis.BroadcastChannel;
    const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));
    type FallbackChanges = { adds: { id: number; when: Date }[]; updates: never[]; removals: never[]; unknown: never[] };
    const changes = (): FallbackChanges => ({ adds: [{ id: 1, when: new Date(0) }], updates: [], removals: [], unknown: [] });

    beforeEach(() => {
        Reflect.deleteProperty(globalThis, "BroadcastChannel");
    });

    afterEach(() => {
        globalThis.BroadcastChannel = originalBroadcastChannel;
    });

    it("constructs, sends, and disposes without throwing", () => {
        const subscription = new SchemaSubscription(mockSchema("fallback-construct"));

        expect(() => subscription.send(changes())).not.toThrow();
        expect(() => subscription.dispose()).not.toThrow();
    });

    it("delivers to a listener in the same process on a later task", async () => {
        const schema = mockSchema("fallback-deliver");
        const sender = new SchemaSubscription(schema);
        const receiver = new SchemaSubscription(schema);
        const callback = jest.fn();
        receiver.onMessage(callback);

        sender.send(changes());

        expect(callback).not.toHaveBeenCalled();

        await nextTask();

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(changes());
    });

    it("delivers a copy rather than the sender's objects", async () => {
        const schema = mockSchema("fallback-copy");
        const sender = new SchemaSubscription(schema);
        const receiver = new SchemaSubscription(schema);
        const received: object[] = [];
        receiver.onMessage(delivered => received.push(delivered.adds[0]));
        const sent = changes();

        sender.send(sent);
        sent.adds[0].id = 2;
        await nextTask();

        expect(received).toEqual([{ id: 1, when: new Date(0) }]);
        expect(received[0]).not.toBe(sent.adds[0]);
    });

    it("fans out to every listener on the channel", async () => {
        const schema = mockSchema("fallback-fanout");
        const sender = new SchemaSubscription(schema);
        const first = jest.fn();
        const second = jest.fn();
        new SchemaSubscription(schema).onMessage(first);
        new SchemaSubscription(schema).onMessage(second);

        sender.send(changes());
        await nextTask();

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
    });

    it("does not deliver to a listener disposed before the task runs", async () => {
        const schema = mockSchema("fallback-dispose");
        const sender = new SchemaSubscription(schema);
        const receiver = new SchemaSubscription(schema);
        const callback = jest.fn();
        receiver.onMessage(callback);

        sender.send(changes());
        receiver.dispose();
        sender.dispose();
        await nextTask();

        expect(callback).not.toHaveBeenCalled();
    });

    it("isolates channels by schema and by scope", async () => {
        const schema = mockSchema("fallback-isolation");
        const otherSchema = new SchemaSubscription(mockSchema("fallback-isolation-other"));
        const otherScope = new SchemaSubscription(schema, undefined, "db-b");
        const callback = jest.fn();
        otherSchema.onMessage(callback);
        otherScope.onMessage(callback);

        new SchemaSubscription(schema, undefined, "db-a").send(changes());
        await nextTask();

        expect(callback).not.toHaveBeenCalled();
    });

    it("keeps working after every subscription on a channel is disposed and a new one opens", async () => {
        const schema = mockSchema("fallback-reopen");
        new SchemaSubscription(schema).dispose();

        const sender = new SchemaSubscription(schema);
        const callback = jest.fn();
        new SchemaSubscription(schema).onMessage(callback);
        sender.send(changes());
        await nextTask();

        expect(callback).toHaveBeenCalledTimes(1);
    });
});
