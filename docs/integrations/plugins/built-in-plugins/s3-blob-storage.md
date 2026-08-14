---
title: S3 and SaaS Blob Storage
---

# S3 and SaaS Blob Storage

`@routier/blob-plugin` can store bytes in AWS S3 or an S3-compatible object-storage service while Routier keeps searchable file metadata in your normal database. The same adapter works with Cloudflare R2, Google Cloud Storage's S3-compatible endpoint, MinIO, and other providers that implement the S3 API.

This page expands the [Files and Blob Storage overview](/integrations/plugins/built-in-plugins/files) with production-oriented provider configuration and a complete direct-upload flow.

## The simple path

Use `S3Plugin` when your Routier datastore runs on the server. Give it the database plugin that stores rows plus ordinary S3 configuration. Routier constructs the AWS client, creates the blob store, and wires the upload wrapper internally.

```ts
import { DataStore } from "@routier/datastore";
import { s } from "@routier/core/schema";
import { SqliteDbPlugin } from "@routier/sqlite-plugin";
import { S3Plugin } from "@routier/blob-plugin/s3";

const documentSchema = s.define("documents", {
  id: s.string().key().identity(),
  title: s.string(),
  file: s.file(),
}).compile();

const plugin = new S3Plugin(new SqliteDbPlugin("app.db"), {
  bucket: process.env.S3_BUCKET!,
  region: process.env.AWS_REGION ?? "us-east-1",
  keyPrefix: "production",
});

class AppStore extends DataStore {
  documents = this.collection(documentSchema).proxy().create();

  constructor() {
    super(plugin);
  }
}

const store = new AppStore();

await store.documents.addAsync({
  title: "Quarterly report",
  file: fileOrBytes,
});
await store.saveChangesAsync(); // Uploads to S3, then saves the row.
```

That is the intended application API: assign content to an `s.file()` property and save. You do not need to construct `S3Client`, call `createFiles`, or call `s3BlobStore`.

`S3Plugin` still receives an inner database plugin because S3 stores file bytes, not queryable rows. Internally it is a wrapper, but applications do not need to assemble that wrapper themselves.

## Architecture

A file has two parts:

1. The database row stores a `FileReference`: key, size, content type, checksum, and file name.
2. The object store holds the bytes under a content-addressed SHA-256 key.

Keep the bucket private. Your server holds storage credentials and issues short-lived signed URLs. Browser code never receives an S3 access key.

```text
Browser ── asks your API for a signed PUT ──> Application server
Browser ── uploads bytes with signed PUT ──> S3 / R2 / S3-compatible service
Browser ── saves FileReference ────────────> Routier datastore
```

## Install

The AWS SDK packages are optional peer dependencies, so install them only when using an S3-compatible store:

```bash
npm install @routier/blob-plugin @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

`@aws-sdk/client-s3` provides object operations. `@aws-sdk/s3-request-presigner` is required for signed upload and download URLs.

## Configure a provider

Pass the provider's standard S3 configuration directly to `S3Plugin`. The bucket must already exist. Routier constructs the client internally.

### AWS S3

The SDK's default credential chain can read `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, profiles, workload identity, or an IAM role.

```ts
const plugin = new S3Plugin(databasePlugin, {
  bucket: process.env.S3_BUCKET!,
  region: process.env.AWS_REGION ?? "us-east-1",
  keyPrefix: "production",
});
```

### Cloudflare R2

Create an R2 API token with object read and write access. R2 exposes an S3-compatible endpoint:

```ts
const plugin = new S3Plugin(databasePlugin, {
  bucket: process.env.R2_BUCKET!,
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  keyPrefix: "production",
});
```

### Google Cloud Storage

Enable interoperability access and use its access key and secret with the XML API endpoint:

```ts
const plugin = new S3Plugin(databasePlugin, {
  bucket: process.env.GCS_BUCKET!,
  region: "auto",
  endpoint: "https://storage.googleapis.com",
  credentials: {
    accessKeyId: process.env.GCS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.GCS_SECRET_ACCESS_KEY!,
  },
});
```

### MinIO or another S3-compatible service

Local MinIO commonly needs path-style addressing:

```ts
const plugin = new S3Plugin(databasePlugin, {
  bucket: process.env.S3_BUCKET!,
  region: "us-east-1",
  endpoint: process.env.S3_ENDPOINT ?? "http://127.0.0.1:9000",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});
```

For another SaaS provider, use the endpoint, region, and S3 credentials supplied by that provider. `S3Plugin` does not depend on an AWS hostname.

### Existing client escape hatch

Most applications should let `S3Plugin` construct the client. If infrastructure code already manages one, pass it as `client`:

```ts
const plugin = new S3Plugin(databasePlugin, {
  bucket: "my-app-files",
  client: existingS3Client,
});
```

The lower-level `createFiles()` and `s3BlobStore()` APIs remain available for custom stores and framework integrations, but they are no longer required for the S3 happy path.

## Automatic upload on save

`S3Plugin` recognizes every `s.file()` property in a pending add or update. Assign a `File`, `Blob`, `Uint8Array`, or string as the property value:

```ts
await store.documents.addAsync({
  title: "Quarterly report",
  file: requestFile,
});

await store.saveChangesAsync();
```

During `saveChangesAsync()`, Routier:

1. Hashes the content and checks whether it already exists.
2. Uploads new bytes to S3.
3. Replaces the staged content with a `FileReference`.
4. Gives the row to the inner database plugin.
5. Commits the database transaction.

If the upload fails, no row is written. If the database save fails afterward, the uploaded object is an orphan that can be collected with `plugin.files.sweepOrphans()`.

## Direct browser upload

Direct upload avoids proxying large files through your application server. The server authorizes the request and signs an exact checksum, content type, and object key. The browser uploads directly to the provider.

### 1. Sign on the server

```ts
import express from "express";
import type { UploadRequest } from "@routier/blob-plugin";

const app = express();
app.use(express.json());

app.post("/api/uploads/sign", requireUser, async (request, response) => {
  const upload = request.body as UploadRequest;

  // These are client claims. Enforce your application policy before signing.
  if (upload.size > 25 * 1024 * 1024) {
    return response.status(413).json({ error: "File exceeds the 25 MB limit" });
  }
  if (!["image/png", "image/jpeg", "application/pdf"].includes(upload.contentType)) {
    return response.status(415).json({ error: "Unsupported file type" });
  }

  const grant = await plugin.files.createUploadUrl(upload, { expiresIn: 60 });
  return response.json(grant);
});
```

Authenticate this endpoint. A signed URL is a short-lived bearer token that grants permission to write one object.

### 2. Wrap the HTTP database plugin in the browser

`DirectUploadPlugin` is the browser-safe companion to `S3Plugin`. It holds no storage credentials. Wrap an HTTP-backed database plugin once, then assign files and save normally:

```ts
import { DirectUploadPlugin } from "@routier/blob-plugin";
import { HttpTransportDbPlugin } from "@routier/replication-plugin";

const plugin = new DirectUploadPlugin(
  new HttpTransportDbPlugin({ url: "/api/routier" }),
  {
    requestUpload: async descriptor => {
      const response = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(descriptor),
      });

      if (!response.ok) {
        throw new Error(`Upload authorization failed: ${response.status}`);
      }

      return response.json();
    },
  },
);

const store = new AppStore(plugin);

await store.documents.addAsync({
  title: "Quarterly report",
  file: fileInput.files![0],
});
await store.saveChangesAsync(); // signs, uploads to S3, then saves over HTTP
```

The wrapper resolves the `File` before the inner HTTP plugin serializes the change. Only the JSON-safe `FileReference` travels through the Routier database endpoint. This also composes with `HttpSwrDbPlugin`.

The browser hashes the file before requesting a grant. If those bytes already exist, the server returns the reference without an upload URL and the browser transfers nothing.

## Bucket CORS for browser uploads

A browser cannot use a presigned PUT unless the bucket permits your web origin and signed headers. Start with a rule like this and replace the origin:

```json
[
  {
    "AllowedOrigins": ["https://app.example.com"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["content-type", "x-amz-checksum-sha256"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Configure this in the provider's bucket CORS settings. Do not use `*` for production origins when credentials or private application data are involved.

## Signed downloads

Issue a short-lived private download URL from trusted server code:

```ts
const document = await store.documents.firstAsync();
const downloadUrl = await plugin.files.url(document.file, { expiresIn: 300 });
```

Return that URL only after checking that the current user may read the document. Do not make the bucket public just to serve downloads.

## Minimum permissions

The credentials used by your server generally need:

| Capability | S3 permissions |
| --- | --- |
| Upload and existence check | `s3:PutObject`, `s3:GetObject` |
| Signed download | `s3:GetObject` |
| Explicit deletion | `s3:DeleteObject` |
| Orphan sweep | `s3:ListBucket`, `s3:DeleteObject` |

Scope object permissions to the bucket and, when possible, the configured `keyPrefix`. If the application never sweeps or deletes objects, omit those permissions.

## Operational notes

- Keep the bucket private and storage credentials on the server.
- Use a separate `keyPrefix` per application or environment.
- Keep upload grants short-lived and validate size and content type before signing.
- The signature covers both `content-type` and `x-amz-checksum-sha256`; changing either makes the provider reject the PUT.
- Upload and database save cannot share a transaction. Run `plugin.files.sweepOrphans()` against the complete set of live references, starting with `{ dryRun: true }`.
- Uploads are whole-file, single PUT operations. Multipart uploads are not currently implemented.

## Related

- [Files and Blob Storage overview](/integrations/plugins/built-in-plugins/files)
- [Attachments and Dirty Tracking](/guides/attachments)
- [Blob Plugin API](/reference/api/plugins/blob/src/README)
