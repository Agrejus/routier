import { JoinTuple } from "@routier/core/plugins";
import { IdType } from "@routier/core/schema";
import { UnknownRecord } from "@routier/core/utilities";

export type JoinGroup = [UnknownRecord, UnknownRecord[]];

export const groupJoinTuples = (tuples: JoinTuple[], keyOf: (outer: UnknownRecord) => IdType): JoinGroup[] => {
    const groups = new Map<IdType, JoinGroup>();

    for (const [outer, inner] of tuples) {
        const key = keyOf(outer);
        const group: JoinGroup = groups.get(key) ?? [outer, []];

        groups.set(key, group);

        if (inner != null) {
            group[1].push(inner);
        }
    }

    return [...groups.values()];
};
