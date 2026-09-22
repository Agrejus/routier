const pad = (value: number, width: number) => String(value).padStart(width, "0");

export function formatClock(at: number): string {
  const time = new Date(at);
  return `${pad(time.getHours(), 2)}:${pad(time.getMinutes(), 2)}:${pad(time.getSeconds(), 2)}.${pad(time.getMilliseconds(), 3)}`;
}

export function formatDuration(durationMs: number | null): string {
  if (durationMs === null) return "live re-run";
  return durationMs < 10 ? `${durationMs.toFixed(1)} ms` : `${Math.round(durationMs)} ms`;
}
