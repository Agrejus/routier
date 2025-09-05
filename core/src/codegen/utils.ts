/**
 * Counts non-overlapping occurrences of a term in text.
 *
 * Behavior:
 * - Case-sensitive matching
 * - If the search term is composed entirely of word characters (A–Z, a–z, 0–9, _),
 *   enforce whole-word boundaries so "red" does not match inside "redder".
 * - If the search term contains any non-word character (e.g. "=>", "()", "::"),
 *   match anywhere without boundary checks (useful for symbols).
 * - Non-overlapping matches (after a hit, advances by term length)
 * - Optimized single-character fast path; otherwise uses indexOf loop
 *
 * Examples:
 * - countWordOccurance("red redder red", "red") => 2
 * - countWordOccurance("()=>{}", "=>") => 1
 * - countWordOccurance("aaaa", "aa") => 2 (non-overlapping)
 *
 * @param text The source text to scan
 * @param word The term to match (must be non-empty)
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

    // Decide whether to enforce word boundaries based on the search term
    let enforceWordBoundaries = true;
    for (let k = 0; k < wl; k++) {
        const cc = word.charCodeAt(k);
        if (!isWordCharCode(cc)) {
            enforceWordBoundaries = false;
            break;
        }
    }

    while (true) {
        i = text.indexOf(word, i);
        if (i === -1) break;

        if (enforceWordBoundaries) {
            const left = i - 1;
            const right = i + wl;
            const leftOk = left < 0 || !isWordCharCode(text.charCodeAt(left));
            const rightOk = right >= tl || !isWordCharCode(text.charCodeAt(right));
            if (leftOk && rightOk) count++;
        } else {
            // No boundary enforcement for symbol-containing terms
            count++;
        }
        i += wl; // non-overlapping word matches
    }

    return count;
}