import { uuidv4 } from '@routier/core';
import { MemoryPlugin } from '@routier/memory-plugin';
import { describeEtagContract } from '@routier/test-utils';
import { BlobDbPlugin, createFiles, memoryBlobStore } from '../index';

describeEtagContract('memory behind BlobDbPlugin', () => new BlobDbPlugin(new MemoryPlugin(`blob-etag-${uuidv4()}`), createFiles(memoryBlobStore())));
