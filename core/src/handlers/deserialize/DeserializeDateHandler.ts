import { CodeBuilder, ObjectBuilder } from "../../common/CodeBlock";
import { PropertyInfo } from "../../common/PropertyInfo";
import { SlotPath } from "../../common/SlotPath";
import { SchemaTypes } from "../../schema";
import { PropertyInfoHandler } from "../types";

export class DeserializeDateHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Date) {
            const slotPath = new SlotPath("result.variable.object");
            let objectBuilder = builder.get<ObjectBuilder>(slotPath.get());
            const assignment = `${property.name} instanceof Date ? ${property.name}.toISOString() : ${property.name}`

            if (property.parent == null) {
                objectBuilder.nested(property.name, assignment)

                return builder;
            }

            slotPath.push(...property.getParentPathArray());
            const nestedObjectBuilder = builder.get<ObjectBuilder>(slotPath.get());
            nestedObjectBuilder.nested(property.name, assignment)

            return builder;
        }

        return super.handle(property, builder);
    }
}