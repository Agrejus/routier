override count<TResult extends number>(
    data: unknown,
    option: QueryOption<TShape, "count">
): TResult {
    // If your backend executed COUNT natively
    if (this.backendPerformedCount) {
        // Extract the count value (like SqlTranslator)
        return (data as any)[0].count as TResult;
    }

    // Otherwise, count in memory (like JsonTranslator)
    if (Array.isArray(data)) {
        return data.length as TResult;
    }
    throw new Error("Cannot count");
}