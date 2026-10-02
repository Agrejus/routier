import { pouchRevision } from '../../pouchRevision';
import { s } from '@routier/core';

export const playerMatchSchema = s.define("playerMatch", {
    _id: s.string().key().identity(),
    _rev: s.string().etag(pouchRevision),
    matchId: s.string(),
    playerId: s.string(),
    seasonId: s.string()
}).modify(x => ({
    documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();