import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { logger } from '@routier/core/utilities';
import { emitEvent, rejectedChangesOf, type SyncEvent } from './syncHooks';

const synced: SyncEvent = { type: 'synced', sent: 1, failed: 0, rejected: 0 };

describe('emitEvent', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('hands the event to the listener', () => {
        const seen: SyncEvent[] = [];

        emitEvent(event => seen.push(event), synced);

        expect(seen).toEqual([synced]);
    });

    it('does nothing, and logs nothing, without a listener', () => {
        const logged = jest.spyOn(logger, 'error');

        emitEvent(undefined, synced);

        expect(logged).not.toHaveBeenCalled();
    });

    it('logs a listener that throws instead of letting it escape', () => {
        const logged = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
        const error = new Error('listener broke');

        emitEvent(() => { throw error; }, synced);

        expect(logged).toHaveBeenCalledWith('[Routier] onEvent threw', { type: 'synced', error });
    });
});

describe('rejectedChangesOf', () => {
    it('labels each change with its kind', () => {
        expect(rejectedChangesOf({ adds: ['a'], updates: ['u'], removes: ['r'] })).toEqual([
            { kind: 'add', entity: 'a' },
            { kind: 'update', entity: 'u' },
            { kind: 'remove', entity: 'r' },
        ]);
    });
});
