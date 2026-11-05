import { pathToFileURL } from "node:url";
import { tsImport } from "tsx/esm/api";
import { parseCommandLine, USAGE } from "./args";
import { generate } from "./generate";

const loadModule = async (file: string): Promise<void> => {
    await tsImport(pathToFileURL(file).href, import.meta.url);
};

const run = async (): Promise<number> => {
    const parsed = parseCommandLine(process.argv.slice(2));

    if (parsed.kind === "help") {
        console.log(USAGE);
        return 0;
    }

    if (parsed.kind === "invalid") {
        console.error(`${parsed.message}\n\n${USAGE}`);
        return 1;
    }

    const result = await generate(parsed.options, process.cwd(), loadModule);

    if (!result.ok) {
        console.error(result.problems.join("\n"));
        return 1;
    }

    console.log(`Generated ${result.schemas.join(", ")} in ${result.file}`);
    console.log("Import this file before your schemas, as the first import in your app.");
    return 0;
};

process.exitCode = await run();
