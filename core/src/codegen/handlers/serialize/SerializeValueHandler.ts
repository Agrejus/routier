import { CodeBuilder, SlotBlock } from '../../blocks';
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

            this.emitSerializeNestedAssignment(property, slot, entitySelectorPath);

            return builder;
        }

        return super.handle(property, builder);
    }
}