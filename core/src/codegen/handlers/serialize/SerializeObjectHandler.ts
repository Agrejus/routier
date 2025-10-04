import { CodeBuilder, ObjectBuilder, SlotBlock } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";
export class SerializeObjectHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Object) {
            const slotPath = new SlotPath("assignments");
            let objectBuilder = builder.get<SlotBlock>(slotPath.get());
            const childPath = property.getAssignmentPath({ parent: "result" });

            if (property.parent == null) {
                // first level object
                if (property.isNullable === false && property.isOptional === false) {
                    objectBuilder.assign(`${childPath}`, { name: `[${childPath}]` }).value("{}");
                    return builder;
                }

                // Do nothing if it's nullable or optional as property assignments will check
                // and create if it does not exist.  This way we can handle null/optional
                return builder;
            }

            debugger;
            slotPath.push(...property.getParentPathArray());
            const nestedObjectBuilder = builder.get<ObjectBuilder>(slotPath.get());
            nestedObjectBuilder.nested(property.name, property.name)

            return builder;
        }

        return super.handle(property, builder);
    }
}