import { pouchRevision } from '../../pouchRevision';
import { s } from '@routier/core';

export const playerSchema = s.define("player", {
    _id: s.string().key().identity(),
    _rev: s.string().etag(pouchRevision),
    name: s.string()
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();