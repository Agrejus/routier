import { CodeBuilder, IfBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class SerializeValueHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type != SchemaTypes.Object && property.type != SchemaTypes.Date) {
            const slot = builder.getOrDefault<SlotBlock>("if");
            // Serialize maps in-memory shape -> storage shape: read the entity by
            // property name, write the result by `from` (storage) name
            const entitySelectorPath = property.getAssignmentPath({ parent: "entity" });
            const resultSelectorPath = property.getAssignmentPath({ parent: "result", useFromPropertyName: true });

            if (property.parent == null) {
                // Only assign if the incoming entity has the property, this allows partial serialization
                // Basically only serialize what is there
                slot.if(`Object.hasOwn(entity, "${property.name}")`).appendBody(`${resultSelectorPath} = ${entitySelectorPath}`);
                return builder;
            }

            const parentSelectPath = ["entity", ...property.getParentPathArray()].join(".");
            const parentAssignPath = ["result", ...property.getParentPathArray({ useFromPropertyName: true })].join(".");

            // We need to handle serializing delta changes in getChanges, there is the possibility that child objects are null 
            // and we need to handle that scenario
            const ifSlot = slot.if(`${parentSelectPath} != null && Object.hasOwn(${parentSelectPath}, "${property.name}")`);

            if (property.parent.isNullable || property.parent.isOptional) {
                // Do this for nullable/optional parents.  Parent will be null if its nullable/optional
                const conditionallyCreateParent = new IfBuilder(`${parentAssignPath} == null`).appendBody(`${parentAssignPath} = {}`);
                ifSlot.appendBody(conditionallyCreateParent.toString());
            }

            ifSlot.appendBody(`${resultSelectorPath} = ${entitySelectorPath}`);

            return builder;
        }

        return super.handle(property, builder);
    }
}