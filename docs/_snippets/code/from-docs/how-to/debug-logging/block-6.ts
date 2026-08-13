import { getLogLevel, setLogLevel } from "@routier/core/utilities";

setLogLevel("debug");

// ... later
setLogLevel("silent");

getLogLevel(); // "silent"
