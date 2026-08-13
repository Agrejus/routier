distinct<TResult>(data: unknown, _: QueryOption<TShape, "distinct">): TResult {
    const result = new Set<string | number | Date>();

    for (const value of data) {
        if (typeof value === "number" || typeof value === "string") {
            result.add(value);
        } else if (isDate(value)) {
            result.add(value.toISOString());
        }
    }

    return [...result] as TResult;
}