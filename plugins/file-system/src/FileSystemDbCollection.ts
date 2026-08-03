import fs from 'node:fs';
import path from 'node:path';
import { CompiledSchema } from "@routier/core/schema";
import { CallbackResult, Result } from "@routier/core/results";
import { MemoryDataCollection } from '@routier/core/collections';

export class FileSystemDbCollection extends MemoryDataCollection {

    private path: string;
    private loaded: boolean = false;

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

                super.destroy(done)
            });
        } catch (e: any) {
            done(Result.error(e));
        }
    }

    override load(done: CallbackResult<never>) {

        this.loaded = true;

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

        // Each persist resolves a fresh collection instance, and adds-only persists
        // skip load() as an optimization. Writing this.records without first merging
        // what is already on disk would replace the whole file with just the new adds.
        // Removals and updates always load() first, so their deletions stay deleted.
        if (this.loaded === false) {
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

            fs.writeFile(this.fileNameAndPath, stringifiedData, 'utf8', (error) => {
                if (error) {
                    done(Result.error(error));
                    return;
                }
                done(Result.success());
            });
        });
    }
}