export interface FrameScheduler {
  schedule(update: () => void): void;
  cancel(): void;
}

const NO_FRAME = 0;

export function createFrameScheduler(): FrameScheduler {
  let queued: Array<() => void> = [];
  let frame = NO_FRAME;

  const flush = () => {
    frame = NO_FRAME;
    const updates = queued;
    queued = [];
    for (const update of updates) update();
  };

  return {
    schedule(update) {
      queued.push(update);
      if (frame === NO_FRAME) frame = window.requestAnimationFrame(flush);
    },
    cancel() {
      window.cancelAnimationFrame(frame);
    },
  };
}
