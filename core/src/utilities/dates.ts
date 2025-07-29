export const isDate = (data: unknown): data is Date => {
    if (data == null) {
        return false;
    }

    if (typeof data !== "object") {
        return false;
    }

    return data instanceof Date;
}