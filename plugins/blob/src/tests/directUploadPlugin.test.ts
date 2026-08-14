import { describe, expect, it } from '@jest/globals';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '@routier/memory-plugin';
import { s } from '@routier/core/schema';
import { DirectUploadPlugin } from '../DirectUploadPlugin';
import { referenceFor } from '../direct';

const documentSchema = s.define('documents', {
    id: s.string().key().identity(),
    title: s.string(),
    file: s.file(),
}).compile();

class DocumentStore extends DataStore {
    documents = this.collection(documentSchema).proxy().create();
}

describe('DirectUploadPlugin', () => {
    it('uploads before the inner plugin saves and gives it a JSON-safe reference', async () => {
        const requests: unknown[] = [];
        const uploads: Uint8Array[] = [];
        const plugin = new DirectUploadPlugin(new MemoryPlugin('http-file-upload'), {
            requestUpload: async request => {
                requests.push(request);
                return {
                    upload: { url: 'https://objects.example/upload', headers: { 'content-type': request.contentType } },
                    reference: referenceFor(request),
                };
            },
            fetch: async (_url, init) => {
                uploads.push(init?.body as Uint8Array);
                return { ok: true } as Response;
            },
        });
        const store = new DocumentStore(plugin);

        await store.documents.addAsync({
            title: 'Browser report',
            file: new Blob(['sent directly'], { type: 'text/plain' }),
        });
        await store.saveChangesAsync();

        const [document] = await store.documents.toArrayAsync();
        const json = JSON.parse(JSON.stringify(document.file));

        expect(requests).toHaveLength(1);
        expect(uploads).toHaveLength(1);
        expect(new TextDecoder().decode(uploads[0])).toBe('sent directly');
        expect(json).toEqual(expect.objectContaining({
            key: expect.stringMatching(/^sha256\//),
            checksum: expect.any(String),
            contentType: 'text/plain',
            size: 13,
        }));
    });
});
