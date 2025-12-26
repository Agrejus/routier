import { CodeBuilder, IfBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class SerializeArrayHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Array) {
            const slot = builder.getOrDefault<SlotBlock>("if");
            const entitySelectorPath = property.getAssignmentPath({ parent: "entity", useFromPropertyName: property.isRenamed });
            const resultSelectorPath = property.getAssignmentPath({ parent: "result" });

            if (property.parent == null) {
                slot.if(`Object.hasOwn(entity, "${property.name}")`).appendBody(`${resultSelectorPath} = ${entitySelectorPath}`);
                return builder;
            }

            const parentSelectPath = ["entity", ...property.getParentPathArray()].join(".");
            const parentAssignPath = ["result", ...property.getParentPathArray()].join(".");

            const ifSlot = slot.if(`Object.hasOwn(${parentSelectPath}, "${property.name}")`);

            if (property.parent.isNullable || property.parent.isOptional) {
                const conditionallyCreateParent = new IfBuilder(`${parentAssignPath} == null`).appendBody(`${parentAssignPath} = {}`);
                ifSlot.appendBody(conditionallyCreateParent.toString());
            }

            ifSlot.appendBody(`${resultSelectorPath} = ${entitySelectorPath}`);

            return builder;
        }

        return super.handle(property, builder);
    }
}

