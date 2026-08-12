// Same store — a selector over it. The everyday form.
ctx.players.join(s => s.playerMatches, p => p._id, m => m.playerId)

// A different store — the collection itself.
localStore.players.join(remoteStore.playerMatches, p => p._id, m => m.playerId)