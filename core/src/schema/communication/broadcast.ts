import { now } from "../../performance";
import { Tagged, uuid } from "../../utilities";
import { ISchemaSubscription, SchemaId, SubscriptionChanges } from "../types";

type BroadcastChannelReceiverId = Tagged<string, "BroadcastChannelReceiverId">;
type SubscriptionListenerCallback<T> = (changes: StampedChanges<T>) => void;
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

    private readonly broadcastChannel: BroadcastChannel;

    constructor(schemaId: SchemaId) {
        this.broadcastChannel = new BroadcastChannel(`__routier-schema-subscription-channel:${schemaId}`);
    }

    send(changes: StampedChanges<T>) {
        this.broadcastChannel.postMessage(changes)
    }
}

class SchemaChannelReceiver<T> {

    private readonly broadcastChannel: BroadcastChannel;
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
    private readonly schemaId: SchemaId;
    private readonly createdAt: number;

    constructor(schemaId: SchemaId, signal?: AbortSignal) {
        this.createdAt = now();
        this.id = uuid(8) as BroadcastChannelReceiverId;
        this.schemaId = schemaId;

        signal?.addEventListener("abort", () => {
            this.dispose();
        }, { once: true });
    }

    send(changes: SubscriptionChanges<T>) {
        const regisry = getChannelRegistry<T>(this.schemaId);

        // Send message to all listeners.
        // Since we create a new listener when we do onMessage,
        // we don't need to worry about sending to ourselves, it 
        // can't happen
        regisry.sender.send({
            data: changes,
            timestamp: now()
        });
    }

    onMessage(callback: (changes: SubscriptionChanges<T>) => void) {

        const regisry = getChannelRegistry<T>(this.schemaId);

        // Link the callback to an instance
        regisry.receiver.addListener(this.id, ({ data, timestamp }) => {

            if (timestamp < this.createdAt) {
                // Sent before the receiver was even created
                return;
            }

            callback(data);
        });
    }

    dispose() {
        this[Symbol.dispose]();
    }

    [Symbol.dispose](): void {
        const regisry = getChannelRegistry<T>(this.schemaId);

        // Remove listeners for this instance only
        regisry.receiver.removeListeners(this.id);
    }
}