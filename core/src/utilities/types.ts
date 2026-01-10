export type UnknownRecord = Record<string, unknown>;

/**
 * Creates a branded type from a base type.
 * Similar to typefest's Tagged type, but uses a unique symbol for type safety.
 * 
 * @example
 * type UserId = Branded<number, "UserId">;
 * type ProductId = Branded<number, "ProductId">;
 * 
 * // These are incompatible even though both are numbers
 * const userId: UserId = 123 as UserId;
 * const productId: ProductId = 456 as ProductId;
 * // userId = productId; // Type error!
 */
declare const __brand: unique symbol;
export type Branded<T, Brand extends string> = T & { readonly [__brand]: Brand };