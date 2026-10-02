import { z } from 'zod';

export const clientHeader = 'x-lab-client';

export const rowVersionParser = z.object({ id: z.string(), version: z.number() });

export const wireEntryParser = z.object({
  id: z.number(),
  client: z.string(),
  method: z.string(),
  path: z.string(),
  ifNoneMatch: z.string().nullable(),
  status: z.number(),
  etag: z.string().nullable(),
  versions: z.array(rowVersionParser),
  detail: z.string(),
});

export type RowVersion = z.infer<typeof rowVersionParser>;

export type WireEntry = z.infer<typeof wireEntryParser>;

export const labStateParser = z.object({ lagging: z.boolean() });
