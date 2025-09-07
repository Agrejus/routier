// This happens automatically in _tryStartSync()
const localDb = new PouchDB(this._name);
const remoteDb = new PouchDB(this._options.sync.remoteDb);

const sync = localDb.sync(remoteDb, {
  live: this._options.sync.live,
  retry: this._options.sync.retry,
  back_off_function: (delay) => Math.min(delay * 2, 10000),
});