await localStore.teams
  .join(remoteStore.members, t => t._id, m => m.teamId)
  .toArrayAsync();