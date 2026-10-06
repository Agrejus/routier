import { describe, expect, it } from '@jest/globals';
import type { ChoiceMemory } from '../browserStorage';
import { crossTabTurns, NO_TURN, type TurnLocks } from '../crossTabTurn';

const KEY = 'routier-pglite-turn:opfs-ahp://app';

const mapMemory = (entries: Record<string, string> = {}): ChoiceMemory & { values: Map<string, string> } => {
    const values = new Map(Object.entries(entries));

    return {
        values,
        get: key => values.get(key) ?? null,
        set: (key, value) => {
            values.set(key, value);
        },
        remove: key => {
            values.delete(key);
        },
    };
};

const fifoLocks = (): TurnLocks & { names: string[] } => {
    const names: string[] = [];
    let tail: Promise<void> = Promise.resolve();

    return {
        names,
        request: (name, callback) => {
            names.push(name);
            const run = tail.then(callback);

            tail = run;
            return run;
        },
    };
};

const settled = async (): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 0));
};

describe('crossTabTurns', () => {
    it('locks on the data directory', async () => {
        const locks = fifoLocks();

        (await crossTabTurns('opfs-ahp://app', locks, mapMemory())()).end();

        expect(locks.names).toEqual([KEY]);
    });

    it('marks the turn as held until it ends', async () => {
        const memory = mapMemory();
        const turn = await crossTabTurns('opfs-ahp://app', fifoLocks(), memory)();

        expect(memory.values.get(KEY)).toBe('held');
        turn.end();
        expect(memory.values.has(KEY)).toBe(false);
    });

    it('gives the next caller the turn only after the first ends', async () => {
        const take = crossTabTurns('opfs-ahp://app', fifoLocks(), mapMemory());
        const first = await take();
        let secondArrived = false;
        const second = take().then(turn => {
            secondArrived = true;
            return turn;
        });

        await settled();
        expect(secondArrived).toBe(false);

        first.end();
        (await second).end();
        expect(secondArrived).toBe(true);
    });

    it.each([
        [{}, false],
        [{ [KEY]: 'held' }, true],
    ])('with %j reports abandoned as %s', async (entries, abandoned) => {
        const turn = await crossTabTurns('opfs-ahp://app', fifoLocks(), mapMemory(entries))();

        expect(turn.abandoned).toBe(abandoned);
        turn.end();
    });

    it('rejects when the lock cannot be requested', async () => {
        const locks: TurnLocks = { request: () => Promise.reject(new Error('locks unavailable')) };

        await expect(crossTabTurns('opfs-ahp://app', locks, mapMemory())()).rejects.toThrow('locks unavailable');
    });
});

describe('NO_TURN', () => {
    it('is never abandoned, and ends without effect', async () => {
        const turn = await NO_TURN();

        expect(turn.abandoned).toBe(false);
        expect(turn.end()).toBeUndefined();
    });
});
