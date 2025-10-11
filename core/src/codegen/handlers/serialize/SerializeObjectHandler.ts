import { CodeBuilder, SlotBlock } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";
export class SerializeObjectHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Object) {
            const slotPath = new SlotPath("assignments");
            const childPath = property.getAssignmentPath({ parent: "result" });

            if (property.isNullable || property.isOptional) {
                // Do nothing if it's nullable or optional as property assignments will check
                // and create if it does not exist.  This way we can handle null/optional
                return builder;
            }

            const slot = builder.get<SlotBlock>(slotPath.get());
            slot.assign(`${childPath}`, { name: `[${childPath}]` }).value("{}");

            return builder;
        }

        return super.handle(property, builder);
    }
}