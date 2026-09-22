const v8 = require('v8');
const { BroadcastChannel } = require('worker_threads');

globalThis.structuredClone ??= value => v8.deserialize(v8.serialize(value));
globalThis.BroadcastChannel ??= BroadcastChannel;
