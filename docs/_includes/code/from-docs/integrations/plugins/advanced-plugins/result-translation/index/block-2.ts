filter<TResult>(data: unknown, option: QueryOption<TShape, "filter">): TResult {
    if (option.value.filter) {
        if (option.value.params == null) {
            // Standard filtering
            return data.filter(option.value.filter) as TResult;
        }
        // Parameterized filtering
        const selector = option.value.filter as ParamsFilter<unknown, {}>
        return data.filter(w => selector([w, option.value.params])) as TResult;
    }
    return data as TResult;
}