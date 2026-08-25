import { CompiledSchema } from '@routier/core/schema';
import { ResultColumn } from '@routier/core/plugins';
import { sqlColumnProperties } from './columns';

/**
 * Describing the result of a SQL statement.
 *
 * `ResultColumn` and the projection helper are in `@routier/core/plugins`, because a result
 * description is not a SQL idea. This is here for one reason: what counts as a COLUMN depends on
 * the table layout, and that is SQL's business.
 */

/**
 * The columns an ordinary entity SELECT projects: root properties, under their storage names.
 *
 * Root properties ONLY, and that is the SQL-specific part. `schema.properties` lists `nested`,
 * `nested.inner` and `nested.inner.value` side by side, and a flat table stores that whole subtree
 * in ONE column named for its root — so listing every property names columns that do not exist.
 * A store that nests natively has no such rule, which is why this cannot live in core.
 */
export const entityResultColumns = <T extends {}>(schema: CompiledSchema<T>): ResultColumn[] =>
    sqlColumnProperties(schema).map(property => ({
        name: property.getResolvedName(),
        property,
    }));
