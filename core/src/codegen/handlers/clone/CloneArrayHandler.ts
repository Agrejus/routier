import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class CloneArrayHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Array) {

            if (property.isNullable || property.isOptional) {
                // Child properties will take care of this
                return builder;
            }

            const slot = builder.get<SlotBlock>("assignments");
            const resultAssignmentPath = property.getAssignmentPath({ parent: "result" });

            if (property.parent == null) {
                slot.assign(`${resultAssignmentPath}`).value("{}");
                return builder;
            }
            debugger;

            // slotPath.push(...property.getParentPathArray());
            // const nestedObjectBuilder = builder.get<ObjectBuilder>(slotPath.get());
            // nestedObjectBuilder.nested(property.name, property.name)

            return builder;
        }

        return super.handle(property, builder);
    }
}