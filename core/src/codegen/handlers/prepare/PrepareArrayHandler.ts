import { CodeBuilder, ObjectBuilder, SlotBlock } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class PrepareArrayHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Array) {
            const slotPath = new SlotPath("result", "variable", "object");
            let objectBuilder = builder.getOrDefault<ObjectBuilder>(slotPath.get());

            if (objectBuilder == null) {
                objectBuilder = builder.get<SlotBlock>("result")
                    .assign("const result", { name: "variable" })
                    .object({ name: "object" });
            }

            const entitySelectorPath = property.getSelectrorPath({ parent: "entity", assignmentType: "FORCE_NULLABLE_OR_OPTIONAL" });
            const name = property.from != null ? property.from : property.name;

            if (property.parent == null) {
                objectBuilder.property(`${name}: ${entitySelectorPath}`);
                return builder;
            }

            slotPath.push(...property.getParentPathArray());
            const nestedObjectBuilder = builder.get<ObjectBuilder>(slotPath.get());
            nestedObjectBuilder.property(`${name}: ${entitySelectorPath}`);

            return builder;
        }

        return super.handle(property, builder);
    }
}

