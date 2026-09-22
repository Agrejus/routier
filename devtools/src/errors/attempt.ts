import { reportError } from "./reportError";

export function attempt<T>(action: () => T, context: string, fallback: (error: Error) => T): T {
  try {
    return action();
  } catch (error) {
    return fallback(reportError(context, error instanceof Error ? error : String(error)));
  }
}
