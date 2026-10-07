import { after, before, beforeEach, describe, it } from 'node:test';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { containsText, hasText, hasValue } from './eventually';
import { launchChrome, type LabProcess, startLabProcess } from './browser';

let lab: LabProcess;
let browser: Browser;
let context: BrowserContext | undefined;
let page: Page;

const ACTION_TIMEOUT_MS = 15_000;

const open = async (scenario: string, options: { slowResetMs?: number } = {}) => {
  context = await browser.newContext();
  context.setDefaultTimeout(ACTION_TIMEOUT_MS);
  page = await context.newPage();

  if (options.slowResetMs != null) {
    const delayMs = options.slowResetMs;
    await page.route('**/admin/reset', async route => {
      const response = await route.fetch();
      await new Promise(resolve => setTimeout(resolve, delayMs));
      await route.fulfill({ response });
    });
  }

  await page.goto(`${lab.origin}/#${scenario}`);
  await click('reset');
};

const click = async (testId: string) => {
  const button = page.getByTestId(testId);
  await button.click();
  await button.and(page.locator(':enabled')).waitFor();
};

const editTitle = (client: string, id: string, title: string) => page.getByTestId(`${client}-title-${id}`).fill(title);

const version = (client: string, id: string) => page.getByTestId(`${client}-version-${id}`);

describe('etag lab in a browser', () => {
  before(async () => {
    lab = await startLabProcess();
    browser = await launchChrome();
  });

  after(async () => {
    await browser?.close();
    await lab?.stop();
  });

  beforeEach(async () => {
    await context?.close();
    context = undefined;
  });

  it('waits for a slow reset before loading, so the reset cannot clear the loaded rows', async () => {
    await open('conflict', { slowResetMs: 1_000 });
    await click('alice-load');
    await page.waitForTimeout(1_500);

    await editTitle('alice', 'launch', 'After a slow reset');
    await click('alice-save');

    await hasText(version('alice', 'launch'), 'v2');
  });

  it('refuses the save of a client that read an old version', async () => {
    await open('conflict');
    await click('alice-load');
    await click('bob-load');
    await editTitle('alice', 'launch', 'Alice edit');
    await click('alice-save');
    await hasText(version('alice', 'launch'), 'v2');

    await editTitle('bob', 'launch', 'Bob edit');
    await click('bob-save');

    await containsText(page.getByTestId('bob-message'), 'Refused');
  });

  it('saves once the refused client reads the current version', async () => {
    await open('conflict');
    await click('alice-load');
    await click('bob-load');
    await editTitle('alice', 'launch', 'Alice edit');
    await click('alice-save');
    await editTitle('bob', 'launch', 'Bob edit');
    await click('bob-save');
    await containsText(page.getByTestId('bob-message'), 'Refused');

    await click('bob-reload');
    await click('bob-load');
    await hasText(version('bob', 'launch'), 'v2');
    await editTitle('bob', 'launch', 'Bob edit');
    await click('bob-save');

    await hasText(version('bob', 'launch'), 'v3');
  });

  it('revalidates with If-None-Match and gets a 304', async () => {
    await open('swr');
    await click('swr-read');
    await hasText(version('swr', 'launch'), 'v1');

    await click('swr-read');

    await containsText(page.getByTestId('swr-summary'), '304 Not Modified');
  });

  it('takes the newer version another user saved', async () => {
    await open('swr');
    await click('swr-read');
    await click('swr-server-edit-launch');
    await containsText(page.getByTestId('swr-summary'), 'v2');

    await click('swr-read');

    await containsText(page.getByTestId('swr-summary'), 'launch: server sent v2, replaced local v1');
    await hasText(version('swr', 'launch'), 'v2');
  });

  it('dead-letters a stale edit and takes the server copy', async () => {
    await open('swr');
    await click('swr-read');
    await editTitle('swr', 'retro', 'My edit');
    await click('swr-server-edit-retro');
    await containsText(page.getByTestId('swr-summary'), 'retro to v2');

    await click('swr-save');
    await containsText(page.getByTestId('swr-summary'), '1 rejected');
    await containsText(page.getByTestId('swr-summary'), 'Conflict: HTTP 409');
    await click('swr-read');

    await hasValue(page.getByTestId('swr-title-retro'), /server edit 2/);
    await hasText(version('swr', 'retro'), 'v2');
  });

  it('keeps a newer local row when a lagging replica serves an older one', async () => {
    await open('newest');
    await click('replica-read');
    await hasText(version('replica', 'roadmap'), 'v1');
    await click('replica-toggle');
    await hasText(page.getByTestId('replica-state'), 'Replica lagging');
    await editTitle('replica', 'roadmap', 'Newer');
    await click('replica-save');
    await hasText(version('replica', 'roadmap'), 'v2');

    await click('replica-read');

    await containsText(page.getByTestId('replica-summary'), 'roadmap: server sent v1, kept the newer local v2');
    await hasText(version('replica', 'roadmap'), 'v2');
  });

  it('agrees with the primary once the replica catches up', async () => {
    await open('newest');
    await click('replica-read');
    await click('replica-toggle');
    await editTitle('replica', 'roadmap', 'Newer');
    await click('replica-save');
    await hasText(version('replica', 'roadmap'), 'v2');
    await click('replica-toggle');
    await hasText(page.getByTestId('replica-state'), 'Replica current');

    await click('replica-read');

    await containsText(page.getByTestId('replica-summary'), 'roadmap: both at v2');
  });

  it('acknowledges an optimistic save at once and then adopts the server version', async () => {
    await open('optimistic');
    await click('optimistic-load');
    await hasText(version('optimistic', 'launch'), 'v1');
    await editTitle('optimistic', 'launch', 'Fast edit');

    await click('optimistic-save');

    await containsText(page.getByTestId('optimistic-timeline'), 'launch: acknowledged at once, still v1');
    await containsText(page.getByTestId('optimistic-timeline'), 'the memory copy adopted it');
    await hasText(version('optimistic', 'launch'), 'v2');
  });
});
