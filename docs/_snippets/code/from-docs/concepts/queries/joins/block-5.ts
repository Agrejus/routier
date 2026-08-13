// A condition spanning both sides of the pair: expressible only after the join.
ctx.players
  .join(s => s.playerMatches, p => p._id, m => m.playerId)
  .where(([p, m]) => m.score > p.averageScore)
  .toArrayAsync();
