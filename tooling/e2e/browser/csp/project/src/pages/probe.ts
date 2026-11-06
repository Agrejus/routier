const attempt = (work: () => number): string => {
    try {
        return `ran:${work()}`;
    } catch (error) {
        return error instanceof Error ? error.name : "unknown";
    }
};

Reflect.set(window, "__result", {
    newFunction: attempt(() => Function("return 1")()),
    indirectEval: attempt(() => (0, eval)("1")),
});
