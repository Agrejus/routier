import { CodeBuilder, ObjectBuilder, SlotBlock } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class DeserializeObjectHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Object) {
            const slotPath = new SlotPath("result.variable.object");

            if (builder.getOrDefault<ObjectBuilder>(slotPath.get()) == null) {
                builder.get<SlotBlock>("result").assign("const entity", { name: "variable" }).object({ name: "object" });
            }

            const absentWhenNull = property.isNullable || property.isOptional
                ? property.getSelectrorPath({ parent: "unserialized", assignmentType: "FORCE_NULLABLE_OR_OPTIONAL", useFromPropertyName: true })
                : undefined;

            slotPath.push(...property.getParentPathArray());
            builder.get<ObjectBuilder>(slotPath.get()).nested(property.name, property.name, absentWhenNull);

            return builder;
        }

        return super.handle(property, builder);
    }
}