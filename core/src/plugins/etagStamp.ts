import { CompiledSchema, EtagMode, PropertyInfo, SchemaTypes } from '../schema';
import { uuidv4 } from '../utilities';

type StoredRecord = Record<string, unknown>;

const TIME_WIDTH = 9;
const SEQUENCE_WIDTH = 6;
const NONCE_WIDTH = 8;

let lastTokenTime = 0;
let tokenSequence = 0;

export function etagToGenerate<T extends {}>(schema: CompiledSchema<T>, mode: EtagMode | undefined): PropertyInfo<T> | null {
    return mode === 'keep' ? null : schema.etagProperty;
}

export function stampEtag(property: PropertyInfo<{}> | null, item: StoredRecord, prior: StoredRecord | undefined): void {
    if (property == null) {
        return;
    }

    const name = property.getResolvedName();

    item[name] = property.type === SchemaTypes.Number
        ? nextNumber(prior, name)
        : nextEtagToken();
}

function nextNumber(prior: StoredRecord | undefined, name: string): number {
    const current = prior?.[name];
    return typeof current === 'number' ? current + 1 : 1;
}

export function nextEtagToken(): string {
    const now = Date.now();

    if (now > lastTokenTime) {
        lastTokenTime = now;
        tokenSequence = 0;
    } else {
        tokenSequence += 1;
    }

    return lastTokenTime.toString(36).padStart(TIME_WIDTH, '0') + tokenSequence.toString(36).padStart(SEQUENCE_WIDTH, '0') + uuidv4().slice(0, NONCE_WIDTH);
}
