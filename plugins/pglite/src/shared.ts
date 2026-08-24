import { PostgresDbPluginBase } from '@routier/postgres-plugin-core';
import { pgliteDriver, PGliteDriverOptions, PGliteLike } from './drivers/pglite';

/**
 * A plugin over a PGlite instance the caller already has.
 *
 * For sharing one database with code outside Routier — a live query, a sync client, or an
 * extension set the shipped entry points do not build. In a browser the instance may be a
 * `PGliteWorker`; both satisfy `PGliteLike`.
 *
 * Lives here rather than in either entry point because both export it and it is the same
 * function in each.
 *
 * `destroy` closes the instance and then refuses, because the contract says destroy deletes the
 * data and this plugin cannot know where storage it did not create lives. Pass `deleteStorage`
 * in the options if the caller knows.
 */
export const pgliteDbPlugin = (
    databaseName: string,
    database: PGliteLike | Promise<PGliteLike>,
    options: PGliteDriverOptions = {}
): PostgresDbPluginBase =>
    new PostgresDbPluginBase(pgliteDriver(databaseName, Promise.resolve(database), options));
