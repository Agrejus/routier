import { CodeBuilder, ContainerBlock, SlotBlock } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

/**
 * Handles converting a Date value from JavaScript to a string value.  Should handle remapping here because it is the lowest level in the code here.
 * Remapping higher up could break lower level code
 */
export class SerializeDateHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Date) {
            let objectBuilder = builder.get<SlotBlock>("if");
            // Serialize maps in-memory shape -> storage shape: read the entity by
            // property name, write the result by `from` (storage) name
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity" });
            const entityAssignmentPath = property.getAssignmentPath({
                parent: "result",
                useFromPropertyName: true
            });

            // if it is nullable or optional, assign in an if block, otherwise we
            // could unintentionally assign a property that does not exist. An explicit null IS
            // assigned — it is a legal value, and dropping it here is known-defects #66. The
            // expression already passes null through, since null is not `instanceof Date`.
            if (property.isOptional || property.isNullable) {
                const ifAssignment = `${entityAssignmentPath} = ${entitySelectorPath} instanceof Date ? ${entitySelectorPath}.toISOString() : ${entitySelectorPath}`;
                const rootPath = new SlotPath("if");
                builder.get<ContainerBlock>(rootPath.get()).if(`${entitySelectorPath} !== undefined`).appendBody(ifAssignment);
                return builder;
            }

            if (property.parent == null) {
                const dateExpr = `${entitySelectorPath} instanceof Date ? ${entitySelectorPath}.toISOString() : ${entitySelectorPath}`;
                objectBuilder.if(`Object.hasOwn(entity, "${property.name}")`).appendBody(`${entityAssignmentPath} = ${dateExpr}`);
                return builder;
            }

            // Nested date: same pattern as SerializeValueHandler — if block for parent existence, then assign with toISOString
            const dateExprNested = `${entitySelectorPath} instanceof Date ? ${entitySelectorPath}.toISOString() : ${entitySelectorPath}`;
            this.emitSerializeNestedAssignment(property, objectBuilder, dateExprNested);
            return builder;
        }

        return super.handle(property, builder);
    }
}