import { PropertyInfo } from '../PropertyInfo';

export function findEtagProperty<T extends {}>(properties: PropertyInfo<T>[], collectionName: string): PropertyInfo<T> | null {
    const declared = properties.filter(property => property.isEtag);
    const nested = declared.find(property => property.parent != null);

    if (nested != null) {
        throw new Error(
            `etag() is declared on '${nested.getAssignmentPath()}', which is nested inside another property. ` +
            `An etag must be a root-level property.  Collection Name: ${collectionName}`
        );
    }

    if (declared.length > 1) {
        throw new Error(
            `etag() is declared on ${declared.map(property => `'${property.name}'`).join(', ')}. ` +
            `A schema can declare one etag.  Collection Name: ${collectionName}`
        );
    }

    return declared[0] ?? null;
}
