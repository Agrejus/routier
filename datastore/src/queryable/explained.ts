import { QueryExplanation } from "@routier/core/plugins";

/** What a terminal returns once `.explain()` is in the chain. */
export type Explained<T> = {
    data: T;
    explanation: QueryExplanation;
};

/**
 * A terminal's result type: the rows, or the rows plus the explanation.
 *
 * `[E] extends [true]` rather than `E extends true` so the conditional does not distribute over
 * a union. A helper generic over the flag would otherwise see `Explainable<boolean, Player[]>` widen to
 * `Explained<Player[]> | Player[]`, which is unusable without narrowing that no caller can do.
 */
export type Explainable<E extends boolean, T> = [E] extends [true] ? Explained<T> : T;
