const pairs = await ctx.players
  .leftJoin(s => s.playerMatches, p => p._id, m => m.playerId)
  .toArrayAsync();

for (const [player, match] of pairs) {
  if (match == null) {
    console.log(`${player.name} has not played yet`);
  }
}