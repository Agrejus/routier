export const isNodeRuntime = () => typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null;