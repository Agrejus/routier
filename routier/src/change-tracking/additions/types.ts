import { InferType } from "routier-core";

export interface IAdditions<T extends {}> {
    get(entity: InferType<T>): InferType<T> | undefined;
    set(entity: InferType<T>): void;
    size: number;
    values(): InferType<T>[];
    clear(): void;
}
