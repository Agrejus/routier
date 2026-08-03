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
