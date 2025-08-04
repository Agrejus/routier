import fs from 'node:fs';
import path from 'node:path';
import { MemoryDatabase } from 'routier-plugin-memory';

export class FileSystemDatabase implements MemoryDatabase {

    private path: string;
    private name: string;

    constructor(path: string, name: string) {
        this.path = path;
        this.name = name;
    }

    private get fileNameAndPath() {
        return path.join(this.path, this.name);
    }

    destroy(done: (error: any) => void) {
        try {
            fs.unlink(this.fileNameAndPath, done);
        } catch (e: any) {
            done(e);
        }
    }

    read<T>(done: (error: any, data?: T[]) => void) {
        fs.readFile(this.fileNameAndPath, 'utf8', (error, data) => {
            if (error) {
                done(error);
                return;
            }

            try {
                const parsedData = JSON.parse(data);

                done(null, parsedData);
            } catch (parseError: any) {
                done(parseError);
            }
        });
    }

    save<T>(data: T, done: (error: any, data?: string) => void) {

    }
}