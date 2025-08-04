import { MemoryPlugin } from "routier-plugin-memory";

export class FileSystemPlugin extends MemoryPlugin {

    private path: string;
    private name: string;

    constructor(path: string, name: string) {
        super(name);
        this.path = path;
    }

    [Symbol.dispose](): void {
        throw new Error("Method not implemented.");
    }
}