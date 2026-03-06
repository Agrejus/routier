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
        const schema = {
            id: "schema-1",
            preprocess: (x: unknown) => x,
        } as any;

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
        const schema = {
            id: "schema-idempotent",
            preprocess: (x: unknown) => x,
        } as any;

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
        const schemaA = { id: "schema-A", preprocess: (x: unknown) => x } as any;
        const schemaB = { id: "schema-B", preprocess: (x: unknown) => x } as any;

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
        const schema = { id: "schema-fanout", preprocess: (x: unknown) => x } as any;

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
        const schema = {
            id: "schema-postprocess",
            preprocess,
            postprocess,
        } as any;

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
        const schema = {
            id: "schema-date-roundtrip",
            preprocess,
            postprocess,
        } as any;

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
