override filter<TResult>(
    data: unknown,
    option: QueryOption<TShape, "filter">
): TResult {
    // If backend handled filtering via WHERE clause, return as-is
    if (this.queryWasFilteredByBackend) {
        return data as TResult; // Already filtered
    }

    // Otherwise, filter in memory (backend doesn't support this filter)
    return super.filter(data, option); // Use JsonTranslator behavior
}