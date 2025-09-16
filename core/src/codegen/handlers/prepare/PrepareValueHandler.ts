import { CodeBuilder, ObjectBuilder, SlotBlock } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class PrepareValueHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type != SchemaTypes.Object) {
            let objectBuilder = builder.getOrDefault<ObjectBuilder>("result.variable.object");
            const entitySelectorPath = property.getAssignmentPath({ parent: "entity" });

            if (objectBuilder == null) {
                objectBuilder = builder.get<SlotBlock>("result")
                    .assign("const result", { name: "variable" })
                    .object({ name: "object" });
            }

            // Remap the property to the name in the database if from is set
            const name = property.from != null ? property.from : property.name;

            if (property.parent == null) {
                objectBuilder.property(`${name}: ${entitySelectorPath}`);
                return builder;
            }

            const slotPath = new SlotPath(...property.getParentPathArray());
            objectBuilder = objectBuilder.get<ObjectBuilder>(slotPath.get());
            objectBuilder.property(`${name}: ${entitySelectorPath}`);
            return builder;
        }

        return super.handle(property, builder);
    }
}