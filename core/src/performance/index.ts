const measurements: Record<string, number> = {}

export const now = (): number => {
    if (typeof performance !== 'undefined' && performance.now) {
        // Browser or modern Node.js
        return performance.now();
    }

    // Fallback for older environments
    return Date.now();
}

export const measure = {
    start: (name: string): void => {
        measurements[name] = now();
    },
    end: (name: string): void => {
        const start = measurements[name];

        delete measurements[name];

        const delta = now() - start;

        console.log(`[ROUTIER] - Performance: ${name} took ${delta}`);
    }
}