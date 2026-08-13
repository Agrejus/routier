// How many player-match pairs exist
await ctx.players.join(s => s.playerMatches, p => p._id, m => m.playerId).countAsync();