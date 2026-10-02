import { useState } from 'react';

type Props = { label: string; testId: string; onRun: () => Promise<void>; onError: (message: string) => void };

export function ActionButton({ label, testId, onRun, onError }: Props) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);

    try {
      await onRun();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return <button type="button" data-testid={testId} disabled={busy} onClick={() => void run()}>{label}</button>;
}
