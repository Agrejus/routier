count<TResult>(data: unknown, _: QueryOption<TShape, "count">): TResult {
    if (Array.isArray(data)) {
        return data.length as TResult; // Count all data in memory
    }
    throw new Error("Cannot count resulting data, it must be an array");
}

sum<TResult>(data: unknown, _: QueryOption<TShape, "sum">): TResult {
    assertIsArray(data);
    let sum = 0;
    for (const value of data) {
        if (typeof value !== "number") {
            throw new Error("Cannot sum, property is not a number");
        }
        sum += value; // Sum all data in memory
    }
    return sum as TResult;
}

min<TResult>(data: unknown, _: QueryOption<TShape, "min">): TResult {
    assertIsArray(data);
    data.sort((a, b) => a - b); // Sort all data in memory
    return data[0] as TResult; // Return first (minimum) element
}