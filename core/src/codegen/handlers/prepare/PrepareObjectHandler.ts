import { CodeBuilder, ObjectBuilder } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class PrepareObjectHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Object) {
            const slotPath = new SlotPath("result", "variable", "object");


            slotPath.push(...property.getParentPathArray());
            builder.get<ObjectBuilder>(slotPath.get())
                .nested(property.getResolvedName(), property.name, property.getSelectrorPath({ parent: "entity" }));

            return builder;
        }

        return super.handle(property, builder);
    }
}