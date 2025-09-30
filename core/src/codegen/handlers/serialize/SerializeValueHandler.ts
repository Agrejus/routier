import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class SerializeValueHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type != SchemaTypes.Object && property.type != SchemaTypes.Date) {
            let objectBuilder = builder.getOrDefault<SlotBlock>("if");
            const entitySelectorPath = property.getAssignmentPath({ parent: "entity" });
            const resultSelectorPath = property.getAssignmentPath({ parent: "result" });

            if (property.parent == null) {
                // Only assign if the incoming entity has the property, this allows partial serialization
                // Basically only serialize what is there
                objectBuilder.if(`Object.hasOwn(entity, "${property.name}")`).appendBody(`${resultSelectorPath} = ${entitySelectorPath}`)
                return builder;
            }

            // TODO: SOLVE THIS
            //const slotPath = new SlotPath(...property.getParentPathArray());
            debugger;
            return builder;
        }

        return super.handle(property, builder);
    }
}