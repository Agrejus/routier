import fs from 'node:fs';
import path from 'node:path';
import { CompiledSchema } from "routier-core/schema";
import { CallbackResult, Result } from "routier-core/results";
import { MemoryCollection } from 'routier-core/collections';

export class FileSystemDbCollection extends MemoryCollection {

    private path: string;

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
            this.add(record)
        }
    }

    destroy(done: CallbackResult<never>) {
        try {

            if (fs.existsSync(this.fileNameAndPath) === false) {
                super.destroy(done)
                return;
            }

            fs.unlink(this.fileNameAndPath, (e) => {
                if (e) {
                    done(Result.error(e));
                    return;
                }

                super.destroy(done)
            });
        } catch (e: any) {
            done(Result.error(e));
        }
    }

    load(done: CallbackResult<never>) {

        if (fs.existsSync(this.fileNameAndPath) === false) {
            done(Result.success());
            return;
        }

        fs.readFile(this.fileNameAndPath, 'utf8', (error, data) => {

            if (error) {
                done(Result.error(error));
                return;
            }

            try {
                const records = JSON.parse(data) as Record<string, unknown>[];

                this.hydrate(records);

                done(Result.success());
            } catch (parseError: any) {
                done(Result.error(error));
            }
        });
    }

    save(done: CallbackResult<never>) {
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