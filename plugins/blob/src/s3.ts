export { S3Plugin, type S3PluginOptions } from './S3Plugin';

// Advanced escape hatch. Most applications only need S3Plugin, but custom blob-store
// composition remains available without breaking the original API.
export { s3BlobStore, type S3BlobStoreOptions, type S3ClientLike } from './stores/s3';
