import { parseArgs } from "node:util";

export const USAGE = `Usage: routier generate [schema files or globs...] [--out <folder>]

Finds the schemas your project compiles and writes their functions to
routier.generated.js. Import that file first, and your app runs without "unsafe-eval".

With no files named, it scans src for files that use @routier/core and call .compile().

Options:
  --out <folder>  The folder for the generated file. The default is src.
  --help          Show this message.`;

const DEFAULT_OUT = "src";

export type GenerateOptions = {
    readonly patterns: readonly string[];
    readonly out: string;
};

export type ParsedArgs =
    | { readonly kind: "generate"; readonly options: GenerateOptions }
    | { readonly kind: "help" }
    | { readonly kind: "invalid"; readonly message: string };

const invalid = (message: string): ParsedArgs => ({ kind: "invalid", message });

const toCommand = (positionals: readonly string[], out: string): ParsedArgs => {
    const [command, ...patterns] = positionals;

    if (command !== "generate") {
        return invalid(command == null ? "Name a command." : `Unknown command: ${command}.`);
    }

    return { kind: "generate", options: { patterns, out } };
};

export const parseCommandLine = (argv: readonly string[]): ParsedArgs => {
    try {
        const { values, positionals } = parseArgs({
            args: [...argv],
            allowPositionals: true,
            options: {
                out: { type: "string", default: DEFAULT_OUT },
                help: { type: "boolean" },
            },
        });

        return values.help === true ? { kind: "help" } : toCommand(positionals, values.out);
    } catch (error) {
        return invalid(error instanceof Error ? error.message : String(error));
    }
};
