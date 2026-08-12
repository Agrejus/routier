/**
 * Turning text into terms — the one place it happens, for documents and for queries alike.
 *
 * Running the SAME function on both sides is what makes full-text search return the same rows
 * on every backend. Matching is then set membership over ordinary index rows: no engine
 * tokenises, so no engine can disagree about what a word is. It is also why an enabled stop
 * list can never cause a query/index mismatch — a word stripped from the index is stripped from
 * the query too.
 *
 * Pure and dependency-free by construction. Anything that varied by machine, locale or clock
 * would make one client's index unusable by another.
 */

/**
 * The classic Lucene English stop list, 33 words.
 *
 * A COMPATIBILITY SURFACE. Changing this list changes which queries match against an index
 * built before the change, so it never changes silently — treat an edit here as a schema bump
 * that requires a rebuild.
 */
export const ENGLISH_STOP_WORDS: readonly string[] = [
    "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in",
    "into", "is", "it", "no", "not", "of", "on", "or", "such", "that", "the",
    "their", "then", "there", "these", "they", "this", "to", "was", "will", "with",
];

/**
 * The longest token that can ever be emitted, whatever the options say.
 *
 * The index key is `${term}|${field}|${sourceId}` in a column declared `VARCHAR(255)`, and
 * MySQL truncates past a column's width rather than failing. A caller's tokenizer does not get
 * to break that budget, so this cap applies to the custom path as well as the built-in one.
 */
export const TOKEN_LENGTH_CEILING = 255;

/** Runs of anything that is not a Unicode letter or digit. */
const SEPARATOR = /[^\p{L}\p{N}]+/u;

export type StopWords = "english" | "none" | readonly string[];

/** A caller's own tokenizer. Must be pure and deterministic; documented, not enforced. */
export type Tokenizer = (text: string) => string[];

export type TokenizeOptions = {
    /** Lowercase before splitting. Default true. */
    lowercase?: boolean;
    /** Tokens shorter than this are dropped. Default 2, which removes "a" and "I". */
    minTokenLength?: number;
    /** Tokens longer than this are TRUNCATED, not dropped. Default 64. */
    maxTokenLength?: number;
    /** Default "none" — see the spec for why English is not the default. */
    stopWords?: StopWords;
    /** Replaces the whole built-in pipeline. Every other option is then ignored. */
    tokenizer?: Tokenizer;
};

const DEFAULT_LOWERCASE = true;
const DEFAULT_MIN_TOKEN_LENGTH = 2;
const DEFAULT_MAX_TOKEN_LENGTH = 64;

const resolveStopWords = (stopWords: StopWords | undefined, lowercase: boolean): Set<string> => {

    if (stopWords == null || stopWords === "none") {
        return new Set();
    }

    const words = stopWords === "english" ? ENGLISH_STOP_WORDS : stopWords;

    // Cased the same way the tokens are, or a custom list written in title case would silently
    // match nothing.
    return new Set(lowercase ? words.map(word => word.toLowerCase()) : words);
};

/**
 * Text in, terms out. Duplicates are KEPT, because their count is the term frequency.
 *
 * Null, undefined and a non-string all produce no terms rather than throwing: a nullable or
 * optional searchable property is legal and simply contributes nothing.
 *
 * The built-in pipeline, in order:
 *   1. lowercase (no locale argument — locale-sensitive casing is machine-dependent)
 *   2. split on runs of non-letter, non-digit characters
 *   3. drop tokens shorter than `minTokenLength`
 *   4. truncate tokens longer than `maxTokenLength` — truncate, so a 250-character pasted URL
 *      stays findable by its prefix instead of vanishing
 *   5. drop stop words
 */
export const tokenize = (value: unknown, options: TokenizeOptions = {}): string[] => {

    if (typeof value !== "string" || value.length === 0) {
        return [];
    }

    if (options.tokenizer != null) {
        const emitted = options.tokenizer(value);

        if (Array.isArray(emitted) === false) {
            return [];
        }

        const capped: string[] = [];

        for (const token of emitted) {
            // An empty token would build the key `|field|id`, which collides with every other
            // empty token for that document. Dropped rather than stored.
            if (typeof token !== "string" || token.length === 0) {
                continue;
            }

            capped.push(token.length > TOKEN_LENGTH_CEILING ? token.slice(0, TOKEN_LENGTH_CEILING) : token);
        }

        return capped;
    }

    const lowercase = options.lowercase ?? DEFAULT_LOWERCASE;
    const minTokenLength = options.minTokenLength ?? DEFAULT_MIN_TOKEN_LENGTH;
    const maxTokenLength = Math.min(options.maxTokenLength ?? DEFAULT_MAX_TOKEN_LENGTH, TOKEN_LENGTH_CEILING);
    const stopWords = resolveStopWords(options.stopWords, lowercase);

    const source = lowercase ? value.toLowerCase() : value;
    const tokens: string[] = [];

    for (const candidate of source.split(SEPARATOR)) {

        // The split emits empty strings when the text starts or ends with a separator.
        if (candidate.length === 0 || candidate.length < minTokenLength) {
            continue;
        }

        const token = candidate.length > maxTokenLength ? candidate.slice(0, maxTokenLength) : candidate;

        if (stopWords.has(token)) {
            continue;
        }

        tokens.push(token);
    }

    return tokens;
};

/**
 * Terms and how often each one occurs — one index row's worth of information per entry.
 *
 * Insertion-ordered, so two runs over the same text produce index rows in the same order. That
 * costs nothing (a `Map` is ordered anyway) and makes a diff of two builds readable.
 */
export const countTerms = (value: unknown, options: TokenizeOptions = {}): Map<string, number> => {
    const frequencies = new Map<string, number>();

    for (const token of tokenize(value, options)) {
        frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    }

    return frequencies;
};
