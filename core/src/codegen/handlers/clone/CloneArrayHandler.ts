import { CodeBuilder, IfBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class CloneArrayHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Array) {
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity" });
            const resultAssignmentPath = property.getAssignmentPath({ parent: "result" });
            const slot = builder.get<SlotBlock>("if");

            // Always use JSON.parse(JSON.stringify()) for deep cloning to ensure nested structures are cloned
            // This handles both arrays of primitives and arrays of objects correctly
            const cloneCode = `JSON.parse(JSON.stringify(${entitySelectorPath}))`;

            if (property.parent == null) {
                if (property.isNullable || property.isOptional) {
                    slot.if(`${entitySelectorPath} != null`).appendBody(`${resultAssignmentPath} = ${entitySelectorPath} != null ? ${cloneCode} : null;`);
                } else {
                    slot.if(`${entitySelectorPath} != null`).appendBody(`${resultAssignmentPath} = ${cloneCode};`);
                }
                return builder;
            }

            const propertyParentPath = ["result", ...property.getParentPathArray()];
            const ifBuilder = new IfBuilder(`${propertyParentPath.join("?.")} == null`).appendBody(`${propertyParentPath.join(".")} = {};`);

            if (property.isNullable || property.isOptional) {
                slot.if(`${entitySelectorPath} != null`).appendBody(ifBuilder.toString()).appendBody(`${resultAssignmentPath} = ${entitySelectorPath} != null ? ${cloneCode} : null;`);
            } else {
                slot.if(`${entitySelectorPath} != null`).appendBody(ifBuilder.toString()).appendBody(`${resultAssignmentPath} = ${cloneCode};`);
            }

            return builder;
        }

        return super.handle(property, builder);
    }
}