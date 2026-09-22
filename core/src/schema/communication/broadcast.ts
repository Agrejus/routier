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

export type SchemaSubscriptionOptions = {
    /**
     * Whether changes must reach listeners OUTSIDE this process — another browser tab, or
     * another worker thread in Node. Default `true`, which is the historical behaviour.
     *
     * It cannot be inferred. A BroadcastChannel gives a sender no way to ask who is on the
     * other end, so `send` can only count the listeners registered in THIS process. When
     * this is `true`, `send` must assume a listener it cannot see and always publish. When
     * a caller sets it to `false`, it promises there is no such listener, and `send` skips
     * the whole preprocess-and-post step whenever nobody local is listening.
     */
    crossTabSync?: boolean;
};

const registry: Record<string, SchemaChannel<unknown>> = {};

/**
 * Channels are scoped by schema AND database: two databases holding the same schema must not
 * see each other's change notifications, while instances of the same database (another tab, a
 * worker) share a scope and stay connected.
 *
 * Every datastore path supplies a scope — `IDbPlugin.databaseName` is required, so there is no
 * longer a plugin that leaves it out. The unscoped key remains for callers who create a
 * subscription directly off a schema without a database in hand; it is a channel per schema
 * across the whole process, which is what asking for no scope means. A SENDER that omits the
 * scope will not reach datastore listeners, because they are on `schema|databaseName`.
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

class SchemaChannel<T> {

    readonly sender: SchemaChannelSender<T>;
    readonly receiver: SchemaChannelReceiver<T>;

    // An open BroadcastChannel keeps the event loop alive. Channels are shared per schema,
    // so the pair can only close once every subscription using them has been disposed —
    // hence a count rather than a boolean.
    private subscribers: number = 0;

    constructor(channelKey: string) {
        this.receiver = new SchemaChannelReceiver<T>(channelKey);
        this.sender = new SchemaChannelSender<T>(channelKey, this.receiver);
    }

    /**
     * How many callbacks in THIS process are waiting on the channel.
     *
     * Deliberately not `subscribers`: that counts SchemaSubscription instances, and a
     * DataStore constructs one per collection up front purely to SEND from, so it never
     * reaches zero. Only `onMessage` registers a listener, which is the thing a sender
     * can be skipped for. See `SchemaSubscription.send`.
     */
    get listenerCount() {
        return this.receiver.listenerCount;
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

const openBroadcastChannel = (channelKey: string): BroadcastChannelType | null => {
    if (typeof BroadcastChannel !== "function") {
        return null;
    }

    const channel = new BroadcastChannel(`__routier-schema-subscription-channel:${channelKey}`);
    const maybeUnref = (channel as { unref?: () => void }).unref;

    if (typeof maybeUnref === "function") {
        maybeUnref.call(channel);
    }

    return channel;
};

class SchemaChannelSender<T> {

    private readonly broadcastChannel: BroadcastChannelType | null;
    private readonly localReceiver: SchemaChannelReceiver<T>;

    constructor(channelKey: string, localReceiver: SchemaChannelReceiver<T>) {
        this.broadcastChannel = openBroadcastChannel(channelKey);
        this.localReceiver = localReceiver;
    }

    send(changes: StampedChanges<T>) {
        if (this.broadcastChannel != null) {
            this.broadcastChannel.postMessage(changes);
            return;
        }

        const copy = structuredClone(changes);
        setTimeout(() => this.localReceiver.dispatch(copy), 0);
    }

    close() {
        this.broadcastChannel?.close();
    }
}

class SchemaChannelReceiver<T> {

    private readonly broadcastChannel: BroadcastChannelType | null;
    private subscriptions: SubscriptionListener<T>[] = [];

    constructor(channelKey: string) {
        this.broadcastChannel = openBroadcastChannel(channelKey);

        if (this.broadcastChannel != null) {
            this.broadcastChannel.onmessage = (e) => this.dispatch(e.data as StampedChanges<T>);
        }
    }

    dispatch(changes: StampedChanges<T>) {
        const subscriptions = this.subscriptions;

        for (let i = 0, length = subscriptions.length; i < length; i++) {
            subscriptions[i].action(changes);
        }
    }

    get listenerCount() {
        return this.subscriptions.length;
    }

    addListener(id: BroadcastChannelReceiverId, listener: SubscriptionListenerCallback<T>) {
        this.subscriptions.push(new SubscriptionListener<T>(id, listener));
    }

    removeListeners(id: BroadcastChannelReceiverId) {
        this.subscriptions = this.subscriptions.filter(w => w.id !== id);
    }

    close() {
        this.subscriptions = [];

        if (this.broadcastChannel != null) {
            this.broadcastChannel.onmessage = null;
            this.broadcastChannel.close();
        }
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
    private readonly crossTabSync: boolean;
    private isDisposed: boolean = false;

    constructor(schema: CompiledSchemaCore<T>, signal?: AbortSignal, scope?: string, options?: SchemaSubscriptionOptions) {
        this.createdAt = now();
        this.id = uuid(8) as BroadcastChannelReceiverId;
        this.schema = schema;
        this.scope = scope;
        this.crossTabSync = options?.crossTabSync ?? true;

        getChannelRegistry<T>(schema.id, scope).retain();

        signal?.addEventListener("abort", () => {
            this.dispose();
        }, { once: true });
    }

    send(changes: SubscriptionChanges<T>) {
        const regisry = getChannelRegistry<T>(this.schema.id, this.scope);

        // Preprocessing runs over every add, update, removal and unknown, and it ran on every
        // saveChanges even when the message had nowhere to go. Measured on this branch, skipping
        // it is worth ~18% on diff-update-1000 and ~10% on insert-1000.
        //
        // The guard lives here rather than at the call sites so every caller — CollectionBase,
        // View, and anything added later — gets it without repeating the condition.
        if (this.crossTabSync === false && regisry.listenerCount === 0) {
            return;
        }

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