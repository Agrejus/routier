/**
 * Turning a value into text so it can be encrypted, and back again.
 *
 * A ciphertext is text, so everything has to become a string on the way in. What comes back
 * has to be the shape that arrived, or the layers above deserialise something they were not
 * given — and what arrives is not always what the schema declares. A `Date` has already been
 * through the schema's own serialisation by then and is ISO text; a number is still a number.
 *
 * The tag is carried in the text rather than inferred on the way out, because a transform
 * sees a value and not the property it came from.
 */

const NUMBER = 'n:';
const BOOLEAN = 'b:';
const JSON_VALUE = 'j:';
const STRING = 's:';

export const toText = (value: unknown): string => {
    if (typeof value === 'number') {
        return `${NUMBER}${value}`;
    }

    if (typeof value === 'boolean') {
        return `${BOOLEAN}${value}`;
    }

    if (typeof value === 'object') {
        return `${JSON_VALUE}${JSON.stringify(value)}`;
    }

    // Strings and anything a schema has already serialised to text, dates included.
    return `${STRING}${String(value)}`;
};

export const fromText = (text: string): unknown => {
    const body = text.slice(2);

    switch (text.slice(0, 2)) {
        case NUMBER:
            return Number(body);
        case BOOLEAN:
            return body === 'true';
        case JSON_VALUE:
            return JSON.parse(body);
        default:
            return body;
    }
};
