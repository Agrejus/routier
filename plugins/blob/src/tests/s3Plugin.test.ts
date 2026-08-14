import { describe, expect, it } from '@jest/globals';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '@routier/memory-plugin';
import { s } from '@routier/core/schema';
import { S3Plugin } from '../S3Plugin';

const documentSchema = s.define('documents', {
    id: s.string().key().identity(),
    title: s.string(),
    file: s.file(),
}).compile();

class DocumentStore extends DataStore {
    documents = this.collection(documentSchema).proxy().create();
}

describe('S3Plugin', () => {
    it('accepts ordinary S3 configuration without requiring a client', () => {
        const plugin = new S3Plugin(new MemoryPlugin('s3-config-api'), {
            bucket: 'documents',
            region: 'us-east-1',
        });

        expect(plugin.databaseName).toBe('s3-config-api');
    });

    it('uploads an s.file value automatically when the datastore saves', async () => {
        const objects = new Map<string, Uint8Array>();
        const client = {
            async send(command: unknown): Promise<unknown> {
                const request = command as { constructor: { name: string }; input: { Key?: string; Body?: Uint8Array } };
                const key = request.input.Key ?? '';

                if (request.constructor.name === 'HeadObjectCommand') {
                    if (!objects.has(key)) {
                        throw Object.assign(new Error('missing'), { name: 'NotFound' });
                    }
                    return {};
                }
                if (request.constructor.name === 'PutObjectCommand') {
                    objects.set(key, request.input.Body!);
                    return {};
                }
                if (request.constructor.name === 'GetObjectCommand') {
                    const bytes = objects.get(key);
                    if (bytes == null) {
                        throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
                    }
                    return { Body: { transformToByteArray: async () => bytes } };
                }

                throw new Error(`Unexpected ${request.constructor.name}`);
            },
        };

        const plugin = new S3Plugin(new MemoryPlugin('s3-simple-api'), {
            bucket: 'documents',
            client,
        });
        const store = new DocumentStore(plugin);

        await store.documents.addAsync({
            title: 'Report',
            file: new Blob(['uploaded on save'], { type: 'text/plain' }),
        });
        await store.saveChangesAsync();

        const [document] = await store.documents.toArrayAsync();

        expect(objects.size).toBe(1);
        expect(document.file.contentType).toBe('text/plain');
        expect(await plugin.files.text(document.file)).toBe('uploaded on save');
    });
});
