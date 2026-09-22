import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { clampDrawerHeight, INITIAL_DRAWER_HEIGHT, KEYBOARD_RESIZE_STEP } from "./drawerHeight";

const KEY_STEPS: Readonly<Record<string, number>> = {
  ArrowUp: KEYBOARD_RESIZE_STEP,
  ArrowDown: -KEYBOARD_RESIZE_STEP,
};

interface DragStart {
  readonly y: number;
  readonly height: number;
}

export function useDrawerResize() {
  const [height, setHeight] = useState(() => clampDrawerHeight(INITIAL_DRAWER_HEIGHT, window.innerHeight));
  const [drag, setDrag] = useState<DragStart | null>(null);

  const startDrag = (event: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDrag({ y: event.clientY, height });
  };

  const dragTo = (start: DragStart, event: JSX.TargetedMouseEvent<HTMLDivElement>) =>
    setHeight(clampDrawerHeight(start.height + start.y - event.clientY, window.innerHeight));

  const endDrag = () => setDrag(null);

  const resizeByKey = (event: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEPS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    setHeight((current) => clampDrawerHeight(current + step, window.innerHeight));
  };

  return { height, drag, startDrag, dragTo, endDrag, resizeByKey };
}
