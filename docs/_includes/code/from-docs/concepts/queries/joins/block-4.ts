const rows = await ctx.players
  .join(s => s.playerMatches, p => p._id, m => m.playerId)
  .where(([p, m]) => p.rank > 10 && m.won === true)
  .sort(([p, m]) => p.rank)
  .map(([p, m]) => ({ name: p.name, matchId: m._id }))
  .toArrayAsync();