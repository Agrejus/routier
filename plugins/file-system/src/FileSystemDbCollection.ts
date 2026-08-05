import fs from 'node:fs';
import path from 'node:path';
import { CompiledSchema } from "@routier/core/schema";
import { CallbackResult, Result } from "@routier/core/results";
import { MemoryDataCollection } from '@routier/core/collections';

// Distinct temp-file names per write, so overlapping saves never write the same temp file.
let temporaryFileCounter = 0;

export class FileSystemDbCollection extends MemoryDataCollection {

    private path: string;
    // The instance is shared process-wide (see FileSystemPlugin's registry), so the file is
    // read exactly once and the in-memory view is authoritative from then on. Re-reading on
    // a later save would resurrect rows another writer removed after the file was written.
    private loadState: 'unloaded' | 'loading' | 'loaded' = 'unloaded';
    private loadWaiters: CallbackResult<never>[] = [];

    constructor(path: string, schema: CompiledSchema<any>) {
        super(schema);
        this.path = path;
    }

    private get fileNameAndPath() {
        return path.join(this.path, this.schema.collectionName + ".json");
    }

    private hydrate(records: Record<string, unknown>[]) {
        for (let i = 0, length = records.length; i < length; i++) {
            const record = records[i] as Record<string, unknown>;
            // Never clobber an in-memory record: save() hydrates AFTER adds have been
            // applied, and stored state must not win over pending mutations
            this.addIfAbsent(record)
        }
    }

    override destroy(done: CallbackResult<never>) {
        try {

            if (fs.existsSync(this.fileNameAndPath) === false) {
                super.destroy(done)
                return;
            }

            fs.unlink(this.fileNameAndPath, (e) => {
                // The existsSync check above is not a guarantee: another destroy for the
                // same file can land in between. A file that is already gone is the
                // outcome destroy wants, so ENOENT is success, not failure.
                if (e && (e as NodeJS.ErrnoException).code !== 'ENOENT') {
                    done(Result.error(e));
                    return;
                }

                // A destroyed collection may be reused (the registry entry can outlive the
                // file when destroy comes through the collection); the next load must
                // re-read rather than trust the emptied view.
                this.loadState = 'unloaded';

                super.destroy(done)
            });
        } catch (e: any) {
            done(Result.error(e));
        }
    }

    override load(done: CallbackResult<never>) {

        if (this.loadState === 'loaded') {
            done(Result.success());
            return;
        }

        // Loads coalesce: whoever arrives while a read is in flight waits for that read
        // instead of starting another, so a save never runs against a half-hydrated view.
        this.loadWaiters.push(done);

        if (this.loadState === 'loading') {
            return;
        }

        this.loadState = 'loading';

        this.readAndHydrate(result => {
            // An error leaves the collection unloaded so the next attempt re-reads;
            // success makes the in-memory view authoritative for the process lifetime.
            this.loadState = result.ok === Result.ERROR ? 'unloaded' : 'loaded';

            const waiters = this.loadWaiters.splice(0, this.loadWaiters.length);

            for (const waiter of waiters) {
                waiter(result);
            }
        });
    }

    private readAndHydrate(done: CallbackResult<never>) {
        if (fs.existsSync(this.fileNameAndPath) === false) {
            done(Result.success());
            return;
        }

        fs.readFile(this.fileNameAndPath, 'utf8', (error, data) => {

            if (error) {
                done(Result.error(error));
                return;
            }

            const trimmed = data.trim();

            if (trimmed.length === 0) {
                // A zero-byte file is an empty collection, not corruption. This happens
                // whenever the file has been created but no records written to it yet.
                done(Result.success());
                return;
            }

            try {
                const records = JSON.parse(trimmed) as Record<string, unknown>[];

                this.hydrate(records);

                done(Result.success());
            } catch (parseError: any) {
                done(Result.error(parseError));
            }
        });
    }

    override save(done: CallbackResult<never>) {

        // Adds-only persists skip load() as an optimization, so the first save must merge
        // what is already on disk before writing — this.records alone would replace the
        // whole file with just the new adds. Later saves see loadState === 'loaded' and the
        // shared in-memory view is already the whole collection.
        if (this.loadState !== 'loaded') {
            this.load(loadResult => {
                if (loadResult.ok === Result.ERROR) {
                    done(loadResult);
                    return;
                }

                this.save(done);
            });
            return;
        }

        const stringifiedData = JSON.stringify(this.records, null, 2);
        const dir = path.dirname(this.fileNameAndPath);

        fs.mkdir(dir, { recursive: true }, (mkdirError) => {
            if (mkdirError) {
                done(Result.error(mkdirError));
                return;
            }

            // Write-to-temp then rename: rename is atomic on POSIX, so a reader (or a
            // crash) sees the old file or the new one, never a torn write. Overlapping
            // saves each rename a complete snapshot; the later one is a superset because
            // both stringified the same shared collection after their own mutation.
            const temporaryPath = `${this.fileNameAndPath}.${process.pid}.${++temporaryFileCounter}.tmp`;

            // Written through an explicit handle so the contents can be flushed before the
            // rename. `writeFile` alone only guarantees the bytes reached the OS page cache:
            // the rename is atomic with respect to READERS, but a power loss can still land
            // the new name over an empty or partial file. `fsync` first makes the rename
            // atomic with respect to CRASHES as well.
            fs.open(temporaryPath, 'w', (openError, fd) => {
                if (openError) {
                    done(Result.error(openError));
                    return;
                }

                const finish = (error: NodeJS.ErrnoException | null) => {
                    fs.close(fd, () => {
                        if (error) {
                            // Leave no half-written temp file behind; a failed save should
                            // not accumulate debris next to the real one.
                            fs.unlink(temporaryPath, () => done(Result.error(error)));
                            return;
                        }

                        fs.rename(temporaryPath, this.fileNameAndPath, (renameError) => {
                            if (renameError) {
                                done(Result.error(renameError));
                                return;
                            }

                            done(Result.success());
                        });
                    });
                };

                fs.writeFile(fd, stringifiedData, 'utf8', (writeError) => {
                    if (writeError) {
                        finish(writeError);
                        return;
                    }

                    fs.fsync(fd, (syncError) => finish(syncError));
                });
            });
        });
    }
}