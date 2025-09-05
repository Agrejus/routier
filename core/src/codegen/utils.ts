/**
 * Counts whole-word, non-overlapping occurrences of a word in text.
 *
 * Behavior:
 * - Case-sensitive matching
 * - Whole-word boundaries only (word chars: A–Z, a–z, 0–9, _)
 * - Non-overlapping matches (after a hit, advances by word length)
 * - Optimized single-character fast path; otherwise uses indexOf loop
 *
 * Examples:
 * - countWordOccurance("red redder red", "red") => 2
 * - countWordOccurance("aa aa", "a") => 2
 * - countWordOccurance("aaaa", "aa") => 2 (non-overlapping)
 *
 * @param text The source text to scan
 * @param word The word to match (must be non-empty)
 * @returns The number of occurrences found
 */
export const countWordOccurance = (text: string, word: string) => {
    const wl = word.length;
    const tl = text.length;

    if (wl === 0 || wl > tl) return 0;

    // Fast path for single-character words
    if (wl === 1) {
        let c = 0;
        const code = word.charCodeAt(0);
        for (let i = 0; i < tl; i++) if (text.charCodeAt(i) === code) c++;
        return c;
    }

    let count = 0;
    let i = 0;

    function isWordCharCode(c: number): boolean {
        return (c >= 48 && c <= 57)      // 0-9
            || (c >= 65 && c <= 90)      // A-Z
            || (c >= 97 && c <= 122)     // a-z
            || c === 95;                 // _
    }

    while (true) {
        i = text.indexOf(word, i);
        if (i === -1) break;

        const left = i - 1;
        const right = i + wl;
        const leftOk = left < 0 || !isWordCharCode(text.charCodeAt(left));
        const rightOk = right >= tl || !isWordCharCode(text.charCodeAt(right));

        if (leftOk && rightOk) count++;
        i += wl; // non-overlapping word matches
    }

    return count;
}