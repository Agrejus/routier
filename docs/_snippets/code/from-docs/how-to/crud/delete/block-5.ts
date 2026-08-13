user.isDeleted = true;
user.deletedAt = new Date();
await ctx.saveChangesAsync();