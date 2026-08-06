/**
 * Removes a package's `dist` before a build.
 *
 * Rspack's `output.clean` cannot do this here: the ESM and CommonJS configs run in parallel,
 * so whichever starts second deletes the output the first just wrote. Cleaning once, before
 * either starts, is the only ordering that works.
 */
import { rmSync } from "node:fs";

rmSync(new URL("dist", `file://${process.cwd()}/`), { recursive: true, force: true });
