import { IdType, InferCreateType, InferType } from "@routier/core/schema";

export interface IAdditionsCollection<T extends {}> {
    get(entity: InferCreateType<T>): InferCreateType<T> | undefined;
    get(entity: InferType<T>): InferCreateType<T> | undefined;
    get(entity: IdType): InferCreateType<T> | undefined;
    has(key: IdType): boolean;
    has(entity: InferCreateType<T>): boolean;
    has(entity: InferType<T>): boolean;
    set(entity: InferCreateType<T>): void;
    size: number;
    values(): InferCreateType<T>[];
    clear(): void;
}
