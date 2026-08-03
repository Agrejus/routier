import { CodeBuilder, ContainerBlock, ObjectBuilder, SlotBlock } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

/**
 * Deserializes arrays per element instead of copying the reference:
 *
 * - Date elements are revived from strings (same convention as DeserializeDateHandler).
 * - Everything else is copied with a spread, so the entity shares no references with
 *   the storage record.
 */
export class DeserializeArrayHandler extends PropertyInfoHandler {

    private copyExpression(property: PropertyInfo<any>, selector: string): string {
        const elementType = property.innerSchema?.type;

        if (elementType === SchemaTypes.Date) {
            return `${selector}.map(function (v) { return typeof v === "string" ? new Date(v) : v; })`;
        }

        return `[...${selector}]`;
    }

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Array) {
            const slotPath = new SlotPath("result.variable.object");

            // Create the result object when this is the first property iterated —
            // handler output cannot depend on schema property order
            let objectBuilder = builder.getOrDefault<ObjectBuilder>(slotPath.get());

            if (objectBuilder == null) {
                objectBuilder = builder.get<SlotBlock>("result")
                    .assign("const entity", { name: "variable" })
                    .object({ name: "object" });
            }

            // Deserialize maps storage shape -> in-memory shape: read the incoming
            // record by `from` (storage) name, write the entity by property name
            const entitySelectorPath = property.getSelectrorPath({ parent: "unserialized", useFromPropertyName: true });
            const entityAssignmentPath = property.getAssignmentPath({ parent: "entity" });
            const valueExpression = `${entitySelectorPath} == null ? ${entitySelectorPath} : ${this.copyExpression(property, entitySelectorPath)}`;

            // if it is nullable or optional, assign in an if block, otherwise we
            // could unintentionally assign null/undefined to a property that does not exist
            if (property.isOptional || property.isNullable) {
                const rootPath = new SlotPath("if");
                builder.get<ContainerBlock>(rootPath.get()).if(`${entitySelectorPath} != null`).appendBody(`${entityAssignmentPath} = ${this.copyExpression(property, entitySelectorPath)}`);
                return builder;
            }

            if (property.parent == null) {
                objectBuilder.property(`${property.name}: ${valueExpression}`);
                return builder;
            }

            const nestedSlotPath = new SlotPath(...property.getParentPathArray());
            const nestedObjectBuilder = objectBuilder.get<ObjectBuilder>(nestedSlotPath.get());
            nestedObjectBuilder.property(`${property.name}: ${valueExpression}`);
            return builder;
        }

        return super.handle(property, builder);
    }
}
