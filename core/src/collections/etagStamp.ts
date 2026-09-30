import { CompiledSchema, EtagMode, PropertyInfo, SchemaTypes } from '../schema';

type StoredRecord = Record<string, unknown>;

const TIME_WIDTH = 9;
const SEQUENCE_WIDTH = 6;

let lastTokenTime = 0;
let tokenSequence = 0;

export function etagToGenerate<T extends {}>(schema: CompiledSchema<T>, mode: EtagMode | undefined): PropertyInfo<T> | null {
    return mode === 'keep' ? null : schema.etagProperty;
}

export function stampEtag(property: PropertyInfo<{}> | null, item: StoredRecord, prior: StoredRecord | undefined): void {
    if (property == null) {
        return;
    }

    item[property.name] = property.type === SchemaTypes.Number
        ? nextNumber(prior, property.name)
        : nextToken();
}

function nextNumber(prior: StoredRecord | undefined, name: string): number {
    const current = prior?.[name];
    return typeof current === 'number' ? current + 1 : 1;
}

function nextToken(): string {
    const now = Date.now();

    if (now > lastTokenTime) {
        lastTokenTime = now;
        tokenSequence = 0;
    } else {
        tokenSequence += 1;
    }

    return lastTokenTime.toString(36).padStart(TIME_WIDTH, '0') + tokenSequence.toString(36).padStart(SEQUENCE_WIDTH, '0');
}
