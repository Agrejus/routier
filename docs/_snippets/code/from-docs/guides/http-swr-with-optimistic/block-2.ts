// ❌ Wrong: OptimisticUpdatesDbPlugin wrapping HttpSwrDbPlugin
const swrPlugin = new HttpSwrDbPlugin(localDb, options);
const optimisticPlugin = new OptimisticUpdatesDbPlugin(swrPlugin); // Don't do this!