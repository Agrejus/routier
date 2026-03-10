sort<TResult>(data: unknown, option: QueryOption<TShape, "sort">): TResult {
    if (Array.isArray(data)) {
        data.sort((a, b) => {
            const aVal = option.value.selector(a);
            const bVal = option.value.selector(b);
            return option.value.direction === "asc"
                ? aVal - bVal
                : bVal - aVal;
        });
    }
    return data as TResult;
}