/**
 * The codec alone, with no schema in the bundle, under a policy that withholds `unsafe-eval`.
 *
 * Isolating it answers a question the full harness cannot: is it the CODEC that fails under CSP,
 * or something that loads before it? Importing `@routier/core/transfer` and nothing else means one
 * thing is under test.
 *
 * Every answer is computed HERE, at import time, and stored as a plain value. It must not be
 * computed from a Playwright `evaluate` callback: those are delivered over CDP, which bypasses the
 * page's eval restriction, so a `new Function` called from one succeeds where the same call in
 * page code throws. Probing that way measures the debugger's privileges, not the page's.
 */
import { ChunkEncoder, decodeChunk, isTransferCodecSupported, TRANSFER_VERSION } from '@routier/core/transfer';

const plan = {
    version: TRANSFER_VERSION,
    columns: [{ name: 'id', encoding: 'float64' as const }],
} as const;

const chunkOfOne = () => {
    const encoder = new ChunkEncoder(plan);

    encoder.appendRow([7]);

    return encoder.take().payload;
};

const attempt = (work: () => unknown) => {
    try {
        return { ok: true, value: work() };
    } catch (error) {
        return { ok: false, error: (error as Error)?.message ?? String(error) };
    }
};

/** False under a policy without `unsafe-eval`: there would be no decoder to run. */
const codecSupported = attempt(() => isTransferCodecSupported());

/** The encoder generates nothing, so it must keep working either way. */
const encoderWorks = attempt(() => chunkOfOne().rowCount === 1);

/** Decoding is what needs a generated function. It must fail loudly, never misreport. */
const decodeResult = attempt(() => decodeChunk(plan, chunkOfOne()));

declare const window: Record<string, unknown>;

window.__csp = {
    codecSupported: codecSupported.ok ? codecSupported.value : `probe threw: ${codecSupported.error}`,
    encoderWorks: encoderWorks.ok ? encoderWorks.value : `probe threw: ${encoderWorks.error}`,
    decodeSucceeded: decodeResult.ok,
    decodeError: decodeResult.ok ? null : decodeResult.error,
};
