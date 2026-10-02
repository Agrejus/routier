import { EtagComparator, EtagValue } from "./types";

export type Etags = {
    readonly numeric: EtagComparator<number>;
    readonly lexical: EtagComparator<string>;
};

const ascending = <T extends EtagValue>(prev: T, next: T): number => (prev < next ? -1 : prev > next ? 1 : 0);

export const etags: Etags = {
    numeric: ascending,
    lexical: ascending,
};
