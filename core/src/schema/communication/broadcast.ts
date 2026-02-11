import { now } from "../../performance";
import { Branded, uuid } from "../../utilities";
import { CompiledSchemaCore, InferType, ISchemaSubscription, SchemaId, SubscriptionChanges } from "../types";

type BroadcastChannelReceiverId = Branded<string, "BroadcastChannelReceiverId">;
type SubscriptionListenerCallback<T> = (changes: StampedChanges<T>) => void;
type BroadcastChannelType = InstanceType<typeof BroadcastChannel>;
interface ISubscriptionAction<T> {
    action(changes: StampedChanges<T>): void
}
type StampedChanges<T> = { data: SubscriptionChanges<T>, timestamp: number };

const registry: Record<SchemaId, SchemaChannel<unknown>> = {};

const getChannelRegistry = <T>(schemaId: SchemaId): SchemaChannel<T> => {

    if (registry[schemaId]) {
        return registry[schemaId] as SchemaChannel<T>;
    }

    const channel = new SchemaChannel<T>(schemaId);

    registry[schemaId] = channel;

    return channel;
}

// Must have a sender and receiver.  Sender cannot listen for it's own message
class SchemaChannel<T> {

    readonly sender: SchemaChannelSender<T>;
    readonly receiver: SchemaChannelReceiver<T>;

    constructor(schemaId: SchemaId) {
        this.sender = new SchemaChannelSender<T>(schemaId);
        this.receiver = new SchemaChannelReceiver<T>(schemaId);
    }
}

class SchemaChannelSender<T> {

    private readonly broadcastChannel: BroadcastChannelType;

    constructor(schemaId: SchemaId) {
        this.broadcastChannel = new BroadcastChannel(`__routier-schema-subscription-channel:${schemaId}`);
    }

    send(changes: StampedChanges<T>) {
        this.broadcastChannel.postMessage(changes)
    }
}

class SchemaChannelReceiver<T> {

    private readonly broadcastChannel: BroadcastChannelType;
    private subscriptions: SubscriptionListener<T>[] = [];

    constructor(schemaId: SchemaId) {
        this.broadcastChannel = new BroadcastChannel(`__routier-schema-subscription-channel:${schemaId}`);

        this.broadcastChannel.onmessage = (e) => {

            // We can't send to the same instance it is not possbile
            const stampedChanges = e.data as StampedChanges<T>;

            for (let i = 0, length = this.subscriptions.length; i < length; i++) {
                const subscription = this.subscriptions[i];

                subscription.action(stampedChanges);
            }
        };
    }

    addListener(id: BroadcastChannelReceiverId, listener: SubscriptionListenerCallback<T>) {
        this.subscriptions.push(new SubscriptionListener<T>(id, listener));
    }

    removeListeners(id: BroadcastChannelReceiverId) {
        this.subscriptions = this.subscriptions.filter(w => w.id !== id);
    }
}

class SubscriptionListener<T> implements ISubscriptionAction<T> {

    readonly id: BroadcastChannelReceiverId;
    private readonly listener: SubscriptionListenerCallback<T>;

    constructor(id: BroadcastChannelReceiverId, listener: SubscriptionListenerCallback<T>) {
        this.id = id;
        this.listener = listener;
    }

    action(changes: StampedChanges<T>) {
        this.listener(changes);
    }
}

export class SchemaSubscription<T extends {}> implements ISchemaSubscription<T> {

    private readonly id: BroadcastChannelReceiverId;
    private readonly schema: CompiledSchemaCore<T>;
    private readonly createdAt: number;

    constructor(schema: CompiledSchemaCore<T>, signal?: AbortSignal) {
        this.createdAt = now();
        this.id = uuid(8) as BroadcastChannelReceiverId;
        this.schema = schema;

        signal?.addEventListener("abort", () => {
            this.dispose();
        }, { once: true });
    }

    send(changes: SubscriptionChanges<T>) {
        const regisry = getChannelRegistry<T>(this.schema.id);

        // cannot send raw data, needs to be preprocessed
        const preprocessedChanges: SubscriptionChanges<T> = {
            adds: new Array<InferType<T>>(changes.adds.length),
            removals: new Array<InferType<T>>(changes.removals.length),
            unknown: new Array<InferType<T>>(changes.unknown.length),
            updates: new Array<InferType<T>>(changes.updates.length),
        };

        for (let i = 0, length = changes.adds.length; i < length; i++) {
            preprocessedChanges.adds[i] = this.schema.preprocess(changes.adds[i]);
        }

        for (let i = 0, length = changes.removals.length; i < length; i++) {
            preprocessedChanges.removals[i] = this.schema.preprocess(changes.removals[i]);
        }

        for (let i = 0, length = changes.unknown.length; i < length; i++) {
            preprocessedChanges.unknown[i] = this.schema.preprocess(changes.unknown[i]);
        }

        for (let i = 0, length = changes.updates.length; i < length; i++) {
            preprocessedChanges.updates[i] = this.schema.preprocess(changes.updates[i]);
        }

        // Send message to all listeners.
        // Since we create a new listener when we do onMessage,
        // we don't need to worry about sending to ourselves, it 
        // can't happen
        regisry.sender.send({
            data: preprocessedChanges,
            timestamp: now()
        });
    }

    onMessage(callback: (changes: SubscriptionChanges<T>) => void) {

        const regisry = getChannelRegistry<T>(this.schema.id);

        // Link the callback to an instance
        regisry.receiver.addListener(this.id, ({ data, timestamp }) => {

            console.log("[ROUTIER] broadcast -> listener received message", {
                data,
                timestamp,
                createdAt: this.createdAt
            });

            if (timestamp < this.createdAt) {
                // Sent before the receiver was even created
                return;
            }

            // Changes were preprocessed before they were sent, need to postprocess them
            const postProcessedChanges: SubscriptionChanges<T> = {
                adds: new Array<InferType<T>>(data.adds.length),
                removals: new Array<InferType<T>>(data.removals.length),
                unknown: new Array<InferType<T>>(data.unknown.length),
                updates: new Array<InferType<T>>(data.updates.length),
            };

            for (let i = 0, length = data.adds.length; i < length; i++) {
                postProcessedChanges.adds[i] = this.schema.preprocess(data.adds[i]);
            }

            for (let i = 0, length = data.removals.length; i < length; i++) {
                postProcessedChanges.removals[i] = this.schema.preprocess(data.removals[i]);
            }

            for (let i = 0, length = data.unknown.length; i < length; i++) {
                postProcessedChanges.unknown[i] = this.schema.preprocess(data.unknown[i]);
            }

            for (let i = 0, length = data.updates.length; i < length; i++) {
                postProcessedChanges.updates[i] = this.schema.preprocess(data.updates[i]);
            }

            callback(postProcessedChanges);
        });
    }

    dispose() {
        this[Symbol.dispose]();
    }

    [Symbol.dispose](): void {
        const regisry = getChannelRegistry<T>(this.schema.id);

        // Remove listeners for this instance only
        regisry.receiver.removeListeners(this.id);
    }
}