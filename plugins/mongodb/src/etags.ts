import { stampEtag } from '@routier/core/collections';
import { PropertyInfo } from '@routier/core/schema';
import { MongoCollection } from './driver';

type Document = Record<string, unknown>;

export async function stampUpdatedEtags(collection: Pick<MongoCollection, 'find'>, etag: PropertyInfo<{}> | null, entities: Document[]): Promise<void> {
    if (etag == null) {
        return;
    }

    const stored = await collection.find({ _id: { $in: entities.map(entity => entity._id) } });
    const priors = new Map(stored.map(document => [document._id, document]));

    for (const entity of entities) {
        stampEtag(etag, entity, priors.get(entity._id));
    }
}

export function withEtag(set: Document, name: string | undefined, entity: Document): Document {
    return name == null ? set : { ...set, [name]: entity[name] };
}
