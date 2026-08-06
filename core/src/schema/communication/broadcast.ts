import { now } from "../../performance";
import { Branded, uuid } from "../../utilities";
import { CompiledSchemaCore, ISchemaSubscription, SchemaId, SubscriptionChanges } from "../types";

type BroadcastChannelReceiverId = Branded<string, "BroadcastChannelReceiverId">;
type SubscriptionListenerCallback<T> = (changes: StampedChanges<T>) => void;
type BroadcastChannelType = InstanceType<typeof BroadcastChannel>;
interface ISubscriptionAction<T> {
    action(changes: StampedChanges<T>): void
}
type StampedChanges<T> = { data: SubscriptionChanges<T>, timestamp: number };

const registry: Record<string, SchemaChannel<unknown>> = {};

/**
 * Channels are scoped by schema AND database identity (when the plugin provides one):
 * two databases holding the same schema must not see each other's change notifications.
 * Instances of the same database (e.g. another tab) share a scope and stay connected.
 */
const getChannelKey = (schemaId: SchemaId, scope?: string) => scope == null ? String(schemaId) : `${schemaId}|${scope}`;

const getChannelRegistry = <T>(schemaId: SchemaId, scope?: string): SchemaChannel<T> => {

    const key = getChannelKey(schemaId, scope);

    if (registry[key]) {
        return registry[key] as SchemaChannel<T>;
    }

    const channel = new SchemaChannel<T>(key);

    registry[key] = channel;

    return channel;
}

// Must have a sender and receiver.  Sender cannot listen for it's own message
class SchemaChannel<T> {

    readonly sender: SchemaChannelSender<T>;
    readonly receiver: SchemaChannelReceiver<T>;

    // An open BroadcastChannel keeps the event loop alive. Channels are shared per schema,
    // so the pair can only close once every subscription using them has been disposed —
    // hence a count rather than a boolean.
    private subscribers: number = 0;

    constructor(channelKey: string) {
        this.sender = new SchemaChannelSender<T>(channelKey);
        this.receiver = new SchemaChannelReceiver<T>(channelKey);
    }

    retain() {
        this.subscribers++;
    }

    /** Returns true when the last subscriber released the channel. */
    release() {
        this.subscribers--;
        return this.subscribers <= 0;
    }

    close() {
        this.sender.close();
        this.receiver.close();
    }
}

/**
 * Stops a channel from holding the process open.
 *
 * A DataStore opens a sender and a receiver per collection, and in Node an open
 * BroadcastChannel is a referenced handle. Without this, any script that builds a store and
 * does not call `destroyAsync()` runs to the end of its code and then hangs forever with two
 * live MessagePorts per collection — including the example in the README.
 *
 * `unref` is Node-only; the browser's BroadcastChannel has no such method and needs none.
 * A channel that is unreferenced still sends and receives normally. It only stops being a
 * reason for the process to stay alive, which is the correct default for a library: a program
 * with no work left should exit.
 */
const unreference = (channel: BroadcastChannelType) => {
    const maybeUnref = (channel as { unref?: () => void }).unref;

    if (typeof maybeUnref === 'function') {
        maybeUnref.call(channel);
    }
};

class SchemaChannelSender<T> {

    private readonly broadcastChannel: BroadcastChannelType;

    constructor(channelKey: string) {
        this.broadcastChannel = new BroadcastChannel(`__routier-schema-subscription-channel:${channelKey}`);
        unreference(this.broadcastChannel);
    }

    send(changes: StampedChanges<T>) {
        this.broadcastChannel.postMessage(changes)
    }

    close() {
        this.broadcastChannel.close();
    }
}

class SchemaChannelReceiver<T> {

    private readonly broadcastChannel: BroadcastChannelType;
    private subscriptions: SubscriptionListener<T>[] = [];

    constructor(channelKey: string) {
        this.broadcastChannel = new BroadcastChannel(`__routier-schema-subscription-channel:${channelKey}`);
        unreference(this.broadcastChannel);

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

    close() {
        this.subscriptions = [];
        this.broadcastChannel.onmessage = null;
        this.broadcastChannel.close();
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
    private readonly scope?: string;
    private readonly createdAt: number;
    private isDisposed: boolean = false;

    constructor(schema: CompiledSchemaCore<T>, signal?: AbortSignal, scope?: string) {
        this.createdAt = now();
        this.id = uuid(8) as BroadcastChannelReceiverId;
        this.schema = schema;
        this.scope = scope;

        getChannelRegistry<T>(schema.id, scope).retain();

        signal?.addEventListener("abort", () => {
            this.dispose();
        }, { once: true });
    }

    send(changes: SubscriptionChanges<T>) {
        const regisry = getChannelRegistry<T>(this.schema.id, this.scope);

        // cannot send raw data, needs to be preprocessed
        const preprocessedChanges: SubscriptionChanges<T> = {
            adds: Array.from({ length: changes.adds.length }),
            removals: Array.from({ length: changes.removals.length }),
            unknown: Array.from({ length: changes.unknown.length }),
            updates: Array.from({ length: changes.updates.length }),
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

        const regisry = getChannelRegistry<T>(this.schema.id, this.scope);

        // Link the callback to an instance
        regisry.receiver.addListener(this.id, ({ data, timestamp }) => {

            if (timestamp < this.createdAt) {
                // Sent before the receiver was even created
                return;
            }

            // Changes were preprocessed before they were sent, need to postprocess them.
            // "diff" enriches and deserializes without attaching a change-tracking proxy
            // or freezing: these entities belong to another instance's unit of work, and
            // subscribers only read them (or reseed them to re-run a query), never persist
            // mutations through them.
            const postProcessedChanges: SubscriptionChanges<T> = {
                adds: Array.from({ length: data.adds.length }),
                removals: Array.from({ length: data.removals.length }),
                unknown: Array.from({ length: data.unknown.length }),
                updates: Array.from({ length: data.updates.length }),
            };

            for (let i = 0, length = data.adds.length; i < length; i++) {
                postProcessedChanges.adds[i] = this.schema.postprocess(data.adds[i], "diff");
            }

            for (let i = 0, length = data.removals.length; i < length; i++) {
                postProcessedChanges.removals[i] = this.schema.postprocess(data.removals[i], "diff");
            }

            for (let i = 0, length = data.unknown.length; i < length; i++) {
                postProcessedChanges.unknown[i] = this.schema.postprocess(data.unknown[i], "diff");
            }

            for (let i = 0, length = data.updates.length; i < length; i++) {
                postProcessedChanges.updates[i] = this.schema.postprocess(data.updates[i], "diff");
            }

            callback(postProcessedChanges);
        });
    }

    dispose() {
        this[Symbol.dispose]();
    }

    [Symbol.dispose](): void {
        // Dispose is idempotent, and it must be: a second release would drop the shared
        // channel's count below zero and close it out from under live subscriptions.
        if (this.isDisposed) {
            return;
        }
        this.isDisposed = true;

        const regisry = getChannelRegistry<T>(this.schema.id, this.scope);

        // Remove listeners for this instance only
        regisry.receiver.removeListeners(this.id);

        // An open BroadcastChannel holds the event loop open, so the last subscription out
        // closes the pair and drops it from the registry.
        if (regisry.release()) {
            regisry.close();
            delete registry[getChannelKey(this.schema.id, this.scope)];
        }
    }
}