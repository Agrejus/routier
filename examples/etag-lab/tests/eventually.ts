import assert from 'node:assert/strict';
import type { Locator } from 'playwright-core';

const ATTEMPTS = 60;
const POLL_MS = 100;

const eventually = async (read: () => Promise<string>, holds: (value: string) => boolean, expected: string): Promise<void> => {
  let last = '';

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    last = await read().catch(() => '');

    if (holds(last)) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }

  assert.fail(`expected ${expected}, last saw ${JSON.stringify(last)}`);
};

export const hasText = (locator: Locator, text: string) =>
  eventually(() => locator.innerText(), value => value.trim() === text, JSON.stringify(text));

export const containsText = (locator: Locator, text: string) =>
  eventually(() => locator.innerText(), value => value.includes(text), `text containing ${JSON.stringify(text)}`);

export const hasValue = (locator: Locator, pattern: RegExp) =>
  eventually(() => locator.inputValue(), value => pattern.test(value), `a value matching ${pattern}`);
