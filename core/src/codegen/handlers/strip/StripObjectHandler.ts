import { CodeBuilder, ObjectBuilder, SlotBlock } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class StripObjectHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Object) {
            const slotPath = new SlotPath("result.variable.object");

            if (builder.getOrDefault<ObjectBuilder>(slotPath.get()) == null) {
                builder.get<SlotBlock>("result").assign("const result", { name: "variable" }).object({ name: "object" });
            }

            slotPath.push(...property.getParentPathArray());
            builder.get<ObjectBuilder>(slotPath.get())
                .nested(property.name, property.name, property.getSelectrorPath({ parent: "entity" }));

            return builder;
        }

        return super.handle(property, builder);
    }
}