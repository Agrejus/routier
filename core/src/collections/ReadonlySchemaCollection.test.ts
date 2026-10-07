import { describe, it, expect } from '@jest/globals';
import { s } from '../schema';
import { SchemaCollection } from './SchemaCollection';

const users = s.define('readonly_users', { id: s.string().key() }).compile();
const orders = s.define('readonly_orders', { id: s.string().key() }).compile();

describe('ReadonlySchemaCollection.getByName', () => {
    const schemas = () => {
        const collection = new SchemaCollection();
        collection.set(users.id, users);
        collection.set(orders.id, orders);
        return collection;
    };

    it('finds the schema with the given collection name', () => {
        expect(schemas().getByName('readonly_orders')).toBe(orders);
        expect(schemas().getByName('readonly_users')).toBe(users);
    });

    it('finds nothing for an unknown collection name', () => {
        expect(schemas().getByName('readonly_missing')).toBeUndefined();
    });
});
