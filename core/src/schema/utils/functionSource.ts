import { EtagComparator, EtagValue } from '../types';

export function compileArrowFunction(source: string): Function {
    const match = source.match(/^\(([^)]*)\)\s*=>\s*(.+)/s);

    if (match == null) {
        throw new Error('Function source is not an arrow function');
    }

    const [, parameters, body] = match;

    return new Function(parameters, body.startsWith('{') ? body : `return ${body}`);
}

export function rehydrateEtagComparator(source: string, propertyName: string): EtagComparator<EtagValue> {
    const comparator = createEtagComparator(source, propertyName);
    return Object.assign(comparator, { toString: () => source });
}

function createEtagComparator(source: string, propertyName: string): EtagComparator<EtagValue> {
    try {
        const compiled = compileArrowFunction(source);
        return (prev, next) => Number(compiled(prev, next));
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return () => {
            throw new Error(`Cannot recreate the etag comparator for property ${propertyName}: ${reason}`);
        };
    }
}
