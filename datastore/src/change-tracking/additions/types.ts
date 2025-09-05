import { InferCreateType, InferType } from "@routier/core/schema";

export interface IAdditions<T extends {}> {
    get(entity: InferCreateType<T> | InferType<T>): InferCreateType<T> | undefined;
    set(entity: InferCreateType<T>): void;
    size: number;
    values(): InferCreateType<T>[];
    clear(): void;
}
