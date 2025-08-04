import { CodeBuilder, ObjectBuilder } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class DeserializeObjectHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Object) {
            const slotPath = new SlotPath("result.variable.object");
            let objectBuilder = builder.get<ObjectBuilder>(slotPath.get());

            if (property.parent == null) {
                objectBuilder.nested(property.name, property.name)

                return builder;
            }

            slotPath.push(...property.getParentPathArray());
            const nestedObjectBuilder = builder.get<ObjectBuilder>(slotPath.get());
            nestedObjectBuilder.nested(property.name, property.name)

            return builder;
        }

        return super.handle(property, builder);
    }
}