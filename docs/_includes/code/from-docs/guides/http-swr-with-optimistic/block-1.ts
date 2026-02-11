// ✅ Correct: HttpSwrDbPlugin wraps OptimisticUpdatesDbPlugin
const optimisticPlugin = new OptimisticUpdatesDbPlugin(localDb);
const swrPlugin = new HttpSwrDbPlugin(optimisticPlugin, options);