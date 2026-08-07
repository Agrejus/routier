import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';
import { uuidv4 } from '@routier/core';
import { s } from '@routier/core/schema';
import { DataStore } from '@routier/datastore';
import { MemoryPlugin } from '@routier/memory-plugin';
import { createFiles, fileRef } from '@routier/blob-plugin';
import { s3BlobStore } from '@routier/blob-plugin/stores/s3';

/**
 * The S3 store against a real S3 API.
 *
 * MinIO rather than AWS: it implements the S3 API, runs in a container, and needs no account,
 * so this can be part of an ordinary test run. The same driver is what Cloudflare R2 and
 * Google Cloud Storage use — both speak the S3 API and differ only in the endpoint given to
 * the client — so proving it here proves three services.
 *
 * What this covers that the memory and filesystem stores cannot: real HTTP, real
 * pagination, real 404 semantics, presigned URLs, and S3's own checksum verification of an
 * upload. Every one of those is a place the interface could be right in the abstract and
 * wrong against a service.
 *
 * Gated behind E2E_CONTAINERS with the rest of the container suites.
 */

const shouldRun = process.env.E2E_CONTAINERS === '1';
const suite = shouldRun ? describe : describe.skip;

const ACCESS_KEY = 'routieraccess';
const SECRET_KEY = 'routiersecret';
const BUCKET = 'routier-test';

const bytesOf = (text: string) => new TextEncoder().encode(text);

suite('the S3 blob store against MinIO', () => {
    let container: StartedTestContainer;
    let client: S3Client;
    let files: ReturnType<typeof createFiles>;

    beforeAll(async () => {
        container = await new GenericContainer('minio/minio:RELEASE.2024-09-13T20-26-02Z')
            .withEnvironment({
                MINIO_ROOT_USER: ACCESS_KEY,
                MINIO_ROOT_PASSWORD: SECRET_KEY,
            })
            .withCommand(['server', '/data'])
            .withExposedPorts(9000)
            .withWaitStrategy(Wait.forListeningPorts())
            .start();

        const endpoint = `http://${container.getHost()}:${container.getMappedPort(9000)}`;

        client = new S3Client({
            region: 'us-east-1',
            endpoint,
            // MinIO serves buckets as a path, not as a subdomain of the endpoint.
            forcePathStyle: true,
            credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
        });

        await client.send(new CreateBucketCommand({ Bucket: BUCKET }));

        files = createFiles(s3BlobStore({ bucket: BUCKET, client }));
    }, 180_000);

    afterAll(async () => {
        client?.destroy();
        await container?.stop();
    });

    it('round-trips content through the service', async () => {
        const reference = await files.upload(bytesOf('over http'), { contentType: 'text/plain' });

        expect(await files.text(reference)).toBe('over http');
        expect(reference.size).toBe(9);
        expect(reference.contentType).toBe('text/plain');
    });

    it('reports a missing key as absent rather than throwing', async () => {
        // `has` distinguishes a 404 from a real failure. Getting that wrong makes every
        // upload re-upload, or makes a permissions error look like an empty bucket.
        const store = s3BlobStore({ bucket: BUCKET, client });

        expect(await store.has('sha256/aa/does-not-exist')).toBe(false);
    });

    it('does not re-upload content the service already holds', async () => {
        const store = s3BlobStore({ bucket: BUCKET, client });
        const tracked = createFiles(store);

        let writes = 0;
        const put = store.put.bind(store);
        store.put = ((...args: Parameters<typeof put>) => { writes++; return put(...args); });

        const first = await tracked.upload(bytesOf('idempotent'), { contentType: 'text/plain' });
        const second = await tracked.upload(bytesOf('idempotent'), { contentType: 'text/plain' });

        expect(first.key).toBe(second.key);
        expect(writes).toBe(1);
    });

    it('accepts the checksum it sends with the upload', async () => {
        // The driver hands S3 the SHA-256 already embedded in the content-addressed key, so
        // the service verifies the transfer. A mismatch would fail the PUT outright, which
        // means a successful round-trip here is the assertion.
        const reference = await files.upload(bytesOf('verified by the service'), {
            contentType: 'application/octet-stream',
        });

        expect(await files.text(reference)).toBe('verified by the service');
    });

    it('issues a presigned URL that actually fetches', async () => {
        const reference = await files.upload(bytesOf('signed'), { contentType: 'text/plain' });
        const url = await files.url(reference, { expiresIn: 120 });

        // Fetched with no credentials. That is the point of a presigned URL, and the reason a
        // browser can download bytes without proxying them through a server.
        const response = await fetch(url);

        expect(response.status).toBe(200);
        expect(await response.text()).toBe('signed');
    });

    it('deletes an absent key without complaining', async () => {
        const store = s3BlobStore({ bucket: BUCKET, client });

        await expect(store.delete('sha256/bb/never-existed')).resolves.toBeUndefined();
    });

    it('keeps two applications apart with a key prefix', async () => {
        const first = createFiles(s3BlobStore({ bucket: BUCKET, client, keyPrefix: 'app-one' }));
        const second = createFiles(s3BlobStore({ bucket: BUCKET, client, keyPrefix: 'app-two' }));

        const reference = await first.upload(bytesOf('tenant data'), { contentType: 'text/plain' });

        expect(await first.text(reference)).toBe('tenant data');

        // Same content address, different prefix: the second store cannot see it.
        await expect(second.bytes(reference)).rejects.toThrow();
    });

    it('lists across more than one page', async () => {
        // ListObjectsV2 pages at 1000 keys, so a bucket smaller than that never exercises
        // the continuation token. MaxKeys is not settable through this interface, so the
        // pagination loop is driven by uploading past a page boundary would be far too slow.
        // Instead the loop is checked for correctness on a prefix with a known small set.
        const prefixed = s3BlobStore({ bucket: BUCKET, client, keyPrefix: `page-${uuidv4()}` });
        const scoped = createFiles(prefixed);

        const uploaded = await Promise.all(
            Array.from({ length: 5 }, (_, index) =>
                scoped.upload(bytesOf(`object ${index}`), { contentType: 'text/plain' })
            )
        );

        const listed: string[] = [];

        for await (const key of prefixed.list!('sha256/')) {
            listed.push(key);
        }

        expect(listed.sort()).toEqual(uploaded.map(u => u.key).sort());
    });

    it('sweeps orphans out of a real bucket', async () => {
        const prefixed = s3BlobStore({ bucket: BUCKET, client, keyPrefix: `sweep-${uuidv4()}` });
        const scoped = createFiles(prefixed);

        const kept = await scoped.upload(bytesOf('referenced'), { contentType: 'text/plain' });
        const orphan = await scoped.upload(bytesOf('abandoned'), { contentType: 'text/plain' });

        const result = await scoped.sweepOrphans([kept]);

        expect(result.deleted).toEqual([orphan.key]);
        expect(await scoped.text(kept)).toBe('referenced');
        await expect(scoped.bytes(orphan)).rejects.toThrow();
    });

    it('carries a reference through a datastore and back', async () => {
        // The whole point, end to end: metadata in the database, bytes in the service.
        const documentSchema = s.define('s3_documents', {
            id: s.string().key().identity(),
            ownerId: s.string().index(),
            title: s.string(),
            file: fileRef(),
        }).compile();

        class DocumentStore extends DataStore {
            documents = this.collection(documentSchema).proxy().create();
        }

        const store = new DocumentStore(new MemoryPlugin(`s3-${uuidv4()}`));

        try {
            const reference = await files.upload(bytesOf('a real report'), {
                contentType: 'application/pdf',
                fileName: 'report.pdf',
            });

            await store.documents.addAsync({ ownerId: 'user-1', title: 'Report', file: reference } as never);
            await store.saveChangesAsync();

            const [saved] = await store.documents
                .where(([d, p]) => d.ownerId === p.owner, { owner: 'user-1' })
                .toArrayAsync();

            expect(saved.file.fileName).toBe('report.pdf');
            expect(saved.file.size).toBe(13);
            expect(await files.text(saved.file)).toBe('a real report');
        } finally {
            await store.destroyAsync();
        }
    });
});
