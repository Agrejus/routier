import type { EtagComparator } from '@routier/core/schema';

export const pouchRevision: EtagComparator<string> = (prev, next) => {
    const prevGeneration = Number(prev.slice(0, prev.indexOf('-')));
    const nextGeneration = Number(next.slice(0, next.indexOf('-')));

    if (prevGeneration !== nextGeneration) {
        return Math.sign(prevGeneration - nextGeneration);
    }

    return prev < next ? -1 : prev > next ? 1 : 0;
};
