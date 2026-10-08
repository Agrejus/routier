import { PropertyInfo, SchemaTypes } from "../../../schema";
import { PropertyInfoHandler } from "../types";
import { CodeBuilder, ObjectBuilder } from '../../blocks';
import { SlotPath } from '../../SlotPath';

export class StripValueHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type != SchemaTypes.Object) {
            let objectBuilder = builder.get<ObjectBuilder>("result.variable.object");
            const entitySelectorPath = property.getAssignmentPath({ parent: "entity" });

            if (property.parent == null) {
                objectBuilder.property(`${property.name}: ${entitySelectorPath}`);
                return builder;
            }

            const slotPath = new SlotPath(...property.getParentPathArray());
            objectBuilder = objectBuilder.get<ObjectBuilder>(slotPath.get());
            objectBuilder.property(`${property.name}: ${entitySelectorPath}`);
            return builder;
        }

        return super.handle(property, builder);
    }
}