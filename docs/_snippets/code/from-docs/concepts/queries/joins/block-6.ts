// Reads only the players in question, then joins
ctx.players.where(p => p.region === "east").join(s => s.playerMatches, p => p._id, m => m.playerId)