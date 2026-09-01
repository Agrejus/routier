import { assertColumnLayout, ChunkEncoder, EncodedTransfer, TransferPlan } from '@routier/core/transfer';
import type { WasmStatement } from './wasmRows';
import { RawSqlite, readRowInto } from './wasmRaw';

/**
 * Stepping a statement straight into columnar chunks.
 *
 * Separate from `wasmWorker.ts` so it can be tested without loading the SQLite WASM module, and
 * separate from the codec so the codec never learns what a statement is. It emits; the caller
 * posts.
 */

/**
 * Reads every remaining row, emitting one chunk each time one fills and once more at the end.
 *
 * `emit` is called with `last: true` exactly once, on the final chunk, and a zero-row result gets
 * exactly that one empty chunk. Whether another row exists is settled BEFORE the chunk is emitted,
 * which is the only way to know a chunk is the last one: a forward-only cursor answers "is there
 * more" only by advancing, and a chunk that filled on the final row would otherwise be posted with
 * `last: false` followed by an empty chunk nothing needs.
 *
 * The caller MUST NOT touch an emitted chunk's typed arrays afterwards. Transfer detaches them,
 * and the encoder allocates fresh ones for the next chunk either way.
 */
export const streamChunks = (
    raw: RawSqlite,
    statement: WasmStatement,
    plan: TransferPlan,
    emit: (transfer: EncodedTransfer, last: boolean) => void
): void => {
    // Before a single row is read. The plan came from the select list and this is what the engine
    // says it prepared; encoding against a disagreement would file every column's values under
    // another column's name and report nothing.
    const names = statement.getColumnNames();

    assertColumnLayout(plan, names);

    const encoder = new ChunkEncoder(plan);
    const pointer = statement.pointer;
    const columnCount = names.length;
    // Reused across rows; the encoder copies each value into its column before the next step.
    const values: unknown[] = new Array(columnCount);

    let hasRow = raw.step(pointer);

    if (hasRow === false) {
        emit(encoder.take(), true);
        return;
    }

    while (hasRow) {
        encoder.appendRow(readRowInto(raw, pointer, columnCount, values));

        hasRow = raw.step(pointer);

        if (encoder.isFull || hasRow === false) {
            emit(encoder.take(), hasRow === false);
        }
    }
};
