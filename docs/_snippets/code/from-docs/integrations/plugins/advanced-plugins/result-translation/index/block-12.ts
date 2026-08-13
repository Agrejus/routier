override count<TResult extends number>(
    data: unknown,
    option: QueryOption<TShape, "count">
): TResult {
    // Your backend returns count differently
    if (Array.isArray(data) && data.length > 0) {
        return (data[0] as any).totalCount as TResult;
    }
    return 0 as TResult;
}