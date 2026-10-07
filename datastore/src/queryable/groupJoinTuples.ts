import { JoinTuple } from "@routier/core/plugins";
import { IdType } from "@routier/core/schema";
import { UnknownRecord } from "@routier/core/utilities";

export type JoinGroup = [UnknownRecord, UnknownRecord[]];

export const groupJoinTuples = (tuples: JoinTuple[], keyOf: (outer: UnknownRecord) => IdType): JoinGroup[] => {
    const groups = new Map<IdType, JoinGroup>();

    for (let i = 0, length = tuples.length; i < length; i++) {
        const tuple = tuples[i];
        const outer = tuple[0];
        const inner = tuple[1];
        const key = keyOf(outer);
        let group = groups.get(key);

        if (group === undefined) {
            group = [outer, []];
            groups.set(key, group);
        }

        if (inner != null) {
            group[1].push(inner);
        }
    }

    return [...groups.values()];
};
