import { assertIsArray } from "@routier/core/assertions";
import { IQuery, JsonTranslator, QueryOption } from "@routier/core/plugins";
import { getStorageDateReviver, StorageDateReviver } from "@routier/core/schema";

/**
 * Skips the work the server already did.
 *
 * `JsonTranslator` evaluates every query option in memory, which is what makes a plugin
 * correct before it is fast. Each override below is a claim that MongoDB applied that option
 * already — and the claim is conditional, because the plugin pushes an option down only when
 * it can do so without changing the answer.
 *
 * The pattern, and the conditions, follow `DexieTranslator`.
 */
export class MongoTranslator<TRoot extends {}, TShape> extends JsonTranslator<TRoot, TShape> {

    /** Set by the plugin for each option it actually sent to the server. */
    readonly pushedDown = {
        filter: false,
        sort: false,
        skip: false,
        take: false,
    };

    override filter<TResult>(data: unknown, option: QueryOption<TShape, "filter">): TResult {
        if (this.pushedDown.filter && option.target === "database") {
            return data as TResult;
        }

        return super.filter(data, option);
    }

    override sort<TResult>(data: unknown, option: QueryOption<TShape, "sort">): TResult {
        if (this.pushedDown.sort && option.target === "database") {
            return data as TResult;
        }

        return super.sort(data, option);
    }

    override skip<TResult>(data: unknown, option: QueryOption<TShape, "skip">): TResult {
        if (this.pushedDown.skip && option.target === "database") {
            return data as TResult;
        }

        return super.skip(data, option);
    }

    override take<TResult>(data: unknown, option: QueryOption<TShape, "take">): TResult {
        if (this.pushedDown.take && option.target === "database") {
            return data as TResult;
        }

        return super.take(data, option);
    }

    /**
     * The datastore writes a date as an ISO string, and a document comes back holding the string. What
     * this runs in JavaScript (a projection, a group, a similarity search, or anything handed back) is the
     * caller's lambdas, which compare and call Dates. Only the dates: keys stay under their `from` names.
     * `null` for a schema with no dates.
     */
    private readonly reviveDates: StorageDateReviver | null;

    constructor(query: IQuery<TRoot, TShape>) {
        super(query);
        this.reviveDates = getStorageDateReviver(query.schema);
    }

    override translate(data: unknown) {
        assertIsArray(data);

        if (this.reviveDates != null) {
            for (let i = 0, length = data.length; i < length; i++) {
                this.reviveDates(data[i] as Record<string, unknown>);
            }
        }

        return super.translate(data);
    }
}
