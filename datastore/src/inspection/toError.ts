import type { InspectedValue } from "./types";

export function toError(error: InspectedValue): Error {
    return error instanceof Error ? error : new Error(String(error));
}
