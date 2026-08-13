/**
 * Renders a `DOMAIN.md` into each domain's first declared directory.
 *
 * Run with `npm run domains:write` after editing the manifest. `domains.test.ts` asserts the
 * files on disk match what this produces, so a hand-edit fails the suite rather than
 * silently becoming a second source of truth.
 */
import fs from "node:fs";
import path from "node:path";
import { DOMAINS, renderDomainDoc } from "./domains";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

for (const domain of DOMAINS) {
    const target = path.join(REPO_ROOT, domain.paths[0], "DOMAIN.md");

    fs.writeFileSync(target, renderDomainDoc(domain));

    console.log(`wrote ${path.relative(REPO_ROOT, target)}`);
}
