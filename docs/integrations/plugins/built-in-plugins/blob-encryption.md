---
title: Files and Encryption
search: false
---

# Files and Encryption

These are separate capabilities and now have dedicated guides:

- [Files and Blob Storage](/integrations/plugins/built-in-plugins/files) — `s.file()`, `BlobDbPlugin`, memory/file-system/S3 blob stores, and direct browser uploads.
- [Encryption](/integrations/plugins/built-in-plugins/encryption) — AES-GCM property transforms, searchable encryption, key rotation, and custom transforms.

Both compose with every storage plugin, but they operate differently: file handling wraps an `IDbPlugin`, while encryption is declared on individual schema properties.
