import { Tagged, uuid } from "../../utilities";
import { ICollectionSubscription, SchemaId, SubscriptionChanges } from "../types";

type BroadcastChannelReceiverId = Tagged<string, "BroadcastChannelReceiverId">;
const registry: Record<SchemaId, SchemaChannelRegistry<unknown>> = {};

const getChannelRegistry = <T>(schemaId: SchemaId): SchemaChannelRegistry<T> => {

    if (registry[schemaId]) {
        return registry[schemaId] as SchemaChannelRegistry<T>;
    }

    const channel = new SchemaChannelRegistry<T>(schemaId);

    registry[schemaId] = channel;

    return channel;
}

type SubscriptionListener<T> = (changes: SubscriptionChanges<T>) => void;

class SchemaChannelRegistry<T> {

    private readonly broadcastChannel: BroadcastChannel;
    private subscriptions: BroadcastChannelReceiver<T>[] = [];

    constructor(schemaId: SchemaId) {
        this.broadcastChannel = new BroadcastChannel(`__routier-schema-subscription-channel:${schemaId}`);

        this.broadcastChannel.onmessage = (event: any) => {
            // We don't care about sending to ourselves, it should happen.  Runs off of the listeners
            const changes = event.data as SubscriptionChanges<T>;

            for (let i = 0, length = this.subscriptions.length; i < length; i++) {
                const subscription = this.subscriptions[i];

                subscription.action(changes);
            }
        };
    }

    send(changes: SubscriptionChanges<T>) {
        this.broadcastChannel.postMessage(changes)
    }

    addListener(id: BroadcastChannelReceiverId, listener: SubscriptionListener<T>) {
        this.subscriptions.push(new BroadcastChannelReceiver<T>(id, listener));
    }

    removeListeners(id: BroadcastChannelReceiverId) {
        this.subscriptions = this.subscriptions.filter(w => w.id !== id);
    }
}

interface IBroadcastChannelAction<T> {
    action(changes: SubscriptionChanges<T>): void
}
class BroadcastChannelReceiver<T> implements IBroadcastChannelAction<T> {

    readonly id: BroadcastChannelReceiverId;
    private readonly listener: SubscriptionListener<T>;

    constructor(id: BroadcastChannelReceiverId, listener: SubscriptionListener<T>) {
        this.id = id;
        this.listener = listener;
    }

    action(changes: SubscriptionChanges<T>) {
        this.listener(changes);
    }
}

export class SubscriptionManager<T extends {}> implements ICollectionSubscription<T> {

    private readonly id: BroadcastChannelReceiverId;
    private readonly schemaId: SchemaId;

    constructor(schemaId: SchemaId, signal?: AbortSignal) {
        this.id = uuid(8) as BroadcastChannelReceiverId;
        this.schemaId = schemaId;

        signal?.addEventListener("abort", () => {
            this.dispose();
        }, { once: true });
    }

    send(changes: SubscriptionChanges<T>) {
        const regisry = getChannelRegistry(this.schemaId);

        // Send message to all listeners.
        // Since we create a new listener when we do onMessage,
        // we don't need to worry about sending to ourselves, it 
        // can't happen
        regisry.send(changes);
    }

    onMessage(callback: (changes: SubscriptionChanges<T>) => void) {

        const regisry = getChannelRegistry(this.schemaId);

        // Link the callback to an instance
        regisry.addListener(this.id, callback);
    }

    dispose() {
        this[Symbol.dispose]();
    }

    [Symbol.dispose](): void {
        const regisry = getChannelRegistry(this.schemaId);

        // Remove listeners for this instance only
        regisry.removeListeners(this.id);
    }
}