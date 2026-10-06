import type { ChoiceMemory } from './browserStorage';

export type Turn = { abandoned: boolean; end: () => void };

export type TurnLocks = {
    request: (name: string, callback: () => Promise<void>) => Promise<void>;
};

export const NO_TURN = (): Promise<Turn> => Promise.resolve({ abandoned: false, end: () => undefined });

export const crossTabTurns = (dataDir: string, locks: TurnLocks, memory: ChoiceMemory): (() => Promise<Turn>) => {
    const name = `routier-pglite-turn:${dataDir}`;

    return () => new Promise<Turn>((resolve, reject) => {
        locks.request(name, () => new Promise<void>(unlock => {
            const abandoned = memory.get(name) != null;

            memory.set(name, 'held');
            resolve({
                abandoned,
                end: () => {
                    memory.remove(name);
                    unlock();
                },
            });
        })).catch(reject);
    });
};
