import { IdType } from "../schema";

export class IdSet {

    readonly ids: readonly IdType[];

    constructor(...ids: IdType[]) {
        this.ids = Object.freeze(ids);
    }

    equals(other: IdSet): boolean {

        if (this.ids.length === 1) {
            return this.ids[0] === other.ids[0];
        }

        return this.toString() === other.toString();
    }

    toString(): string {

        if (this.ids.length === 1) {
            return String(this.ids[0]);
        }

        return this.ids.toString();
    }
}