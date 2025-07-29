export const toMap = <T extends {}>(data: T[], keySelector: (item: T) => T[keyof T] | string) => {

    const result = new Map<T[keyof T] | string, T>();

    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const key = keySelector(item);
        result.set(key, item);
    }

    return result;
}
