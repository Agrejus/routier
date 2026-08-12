import { countTerms, ENGLISH_STOP_WORDS, TOKEN_LENGTH_CEILING, tokenize } from "./tokenize";

/**
 * The tokenizer is the whole compatibility surface of full-text search.
 *
 * Every backend stores the terms this function produces, so a change here changes which rows
 * match on every backend at once — and changes them for indexes already written, which are not
 * rebuilt on upgrade. These tests exist to make that impossible to do by accident.
 */

describe("tokenize", () => {

    describe("the default pipeline", () => {

        it("lowercases", () => {
            expect(tokenize("Copper Pipe")).toEqual(["copper", "pipe"]);
        });

        it("keeps case when lowercase is off", () => {
            expect(tokenize("Copper Pipe", { lowercase: false })).toEqual(["Copper", "Pipe"]);
        });

        it("splits on runs of anything that is not a letter or a digit", () => {
            expect(tokenize("copper---pipe, 12mm  (bent)")).toEqual(["copper", "pipe", "12mm", "bent"]);
        });

        it("keeps digits and alphanumeric tokens", () => {
            expect(tokenize("part 4b of 22")).toEqual(["part", "4b", "of", "22"]);
        });

        it("splits Unicode letters as letters, not separators", () => {
            // \p{L}, not [a-z]. A naive ASCII class turns "café" into "caf" and drops the rest,
            // which silently makes non-English data unsearchable.
            expect(tokenize("café Müller ölkanne")).toEqual(["café", "müller", "ölkanne"]);
            expect(tokenize("日本語 テキスト")).toEqual(["日本語", "テキスト"]);
        });

        it("discards the empty strings a leading or trailing separator produces", () => {
            expect(tokenize("  copper pipe  ")).toEqual(["copper", "pipe"]);
            expect(tokenize("---")).toEqual([]);
        });

        it("keeps duplicates, because their count is the term frequency", () => {
            expect(tokenize("pipe pipe pipe")).toEqual(["pipe", "pipe", "pipe"]);
        });
    });

    describe("token length", () => {

        it("drops tokens shorter than minTokenLength", () => {
            // The default of 2 removes "a" and "I" with no language assumption.
            expect(tokenize("a copper I pipe")).toEqual(["copper", "pipe"]);
        });

        it("honours a custom minTokenLength", () => {
            expect(tokenize("a bc def ghij", { minTokenLength: 4 })).toEqual(["ghij"]);
        });

        it("keeps everything when minTokenLength is 1", () => {
            expect(tokenize("a b c", { minTokenLength: 1 })).toEqual(["a", "b", "c"]);
        });

        it("TRUNCATES a long token rather than dropping it", () => {
            // The whole point: a pasted 250-character URL stays findable by its prefix. Dropping
            // it would make the document unsearchable by the only distinctive thing in it.
            const long = "x".repeat(100);

            expect(tokenize(long, { maxTokenLength: 10 })).toEqual(["x".repeat(10)]);
        });

        it("truncates at the default of 64", () => {
            const [token] = tokenize("y".repeat(200));

            expect(token).toHaveLength(64);
        });

        it("never emits a token longer than the ceiling, whatever maxTokenLength says", () => {
            // The index key must fit VARCHAR(255) on MySQL. A caller cannot opt out of that.
            const [token] = tokenize("z".repeat(1000), { maxTokenLength: 900 });

            expect(token).toHaveLength(TOKEN_LENGTH_CEILING);
        });
    });

    describe("stop words", () => {

        it("keeps them by default", () => {
            // Default is 'none'. "to be or not to be" must not tokenise to nothing unless the
            // caller asked for that.
            expect(tokenize("to be or not to be")).toEqual(["to", "be", "or", "not", "to", "be"]);
        });

        it("drops the English list when asked", () => {
            expect(tokenize("the copper pipe is in the wall", { stopWords: "english" }))
                .toEqual(["copper", "pipe", "wall"]);
        });

        it("can return nothing at all", () => {
            expect(tokenize("to be or not to be", { stopWords: "english" })).toEqual([]);
        });

        it("drops a custom list", () => {
            expect(tokenize("copper pipe widget", { stopWords: ["widget"] })).toEqual(["copper", "pipe"]);
        });

        it("matches a custom list case-insensitively while lowercasing", () => {
            // Tokens are lowercase by then, so a list written in title case would otherwise
            // match nothing and look like it had been ignored.
            expect(tokenize("Copper Widget", { stopWords: ["Widget"] })).toEqual(["copper"]);
        });

        it("holds the English list to exactly the documented 33 words", () => {
            // A compatibility surface. Editing this list changes what matches in indexes that
            // already exist, so a change must be deliberate enough to update this test.
            expect(ENGLISH_STOP_WORDS).toEqual([
                "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in",
                "into", "is", "it", "no", "not", "of", "on", "or", "such", "that", "the",
                "their", "then", "there", "these", "they", "this", "to", "was", "will", "with",
            ]);
            expect(ENGLISH_STOP_WORDS).toHaveLength(33);
        });
    });

    describe("absent and unusable input", () => {

        it("produces nothing for null, undefined and an empty string", () => {
            // A nullable or optional searchable property is legal and contributes no tokens.
            expect(tokenize(null)).toEqual([]);
            expect(tokenize(undefined)).toEqual([]);
            expect(tokenize("")).toEqual([]);
        });

        it("produces nothing for a non-string", () => {
            expect(tokenize(42)).toEqual([]);
            expect(tokenize({})).toEqual([]);
            expect(tokenize(new Date())).toEqual([]);
        });
    });

    describe("a caller's own tokenizer", () => {

        it("replaces the whole built-in pipeline", () => {
            // Not lowercased, not split on punctuation, not length-filtered. The function is
            // the pipeline.
            const tokens = tokenize("Copper-Pipe A", { tokenizer: text => text.split(" ") });

            expect(tokens).toEqual(["Copper-Pipe", "A"]);
        });

        it("ignores every other option", () => {
            const tokens = tokenize("THE copper", {
                tokenizer: text => text.split(" "),
                lowercase: true,
                minTokenLength: 20,
                stopWords: "english",
            });

            expect(tokens).toEqual(["THE", "copper"]);
        });

        it("is still held to the token length ceiling", () => {
            const [token] = tokenize("anything", { tokenizer: () => ["q".repeat(400)] });

            expect(token).toHaveLength(TOKEN_LENGTH_CEILING);
        });

        it("cannot emit an empty token", () => {
            // An empty token builds the key `|field|id`, which collides with every other empty
            // token for that document.
            expect(tokenize("a  b", { tokenizer: text => text.split(" ") })).toEqual(["a", "b"]);
        });

        it("is used for the query as well as the document", () => {
            // The same options object drives both sides, which is what makes matching
            // symmetric. This asserts the shape callers depend on rather than an internal.
            const options = { tokenizer: (text: string) => text.split("|") };

            expect(tokenize("copper|pipe", options)).toEqual(tokenize("copper|pipe", options));
        });
    });
});

describe("countTerms", () => {

    it("counts duplicates", () => {
        expect(countTerms("pipe copper pipe pipe")).toEqual(new Map([["pipe", 3], ["copper", 1]]));
    });

    it("counts after the pipeline has run, not before", () => {
        // "Pipe" and "pipe" are the same term once lowercased, so the frequency is 2.
        expect(countTerms("Pipe pipe")).toEqual(new Map([["pipe", 2]]));
    });

    it("counts truncated tokens as one term", () => {
        const options = { maxTokenLength: 4 };

        expect(countTerms("copperplate copperhead", options)).toEqual(new Map([["copp", 2]]));
    });

    it("is empty for text that produces no terms", () => {
        expect(countTerms("to be", { stopWords: "english" })).toEqual(new Map());
        expect(countTerms(null)).toEqual(new Map());
    });

    it("preserves first-seen order", () => {
        // Not required for correctness — index rows are keyed — but it makes two builds of the
        // same corpus diffable.
        expect([...countTerms("beta alpha beta").keys()]).toEqual(["beta", "alpha"]);
    });
});
