import { CodeBuilder, ObjectBuilder, SlotBlock } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class StripArrayHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Array) {
            const slotPath = new SlotPath("result.variable.object");
            let objectBuilder = builder.getOrDefault<ObjectBuilder>(slotPath.get());
            const entitySelectorPath = property.getAssignmentPath({ parent: "entity" });

            if (objectBuilder == null) {
                objectBuilder = builder.get<SlotBlock>("result")
                    .assign("const result", { name: "variable" })
                    .object({ name: "object" });
            }

            if (property.parent == null) {
                // Use optional chaining to safely access property
                const entitySelectorPathSafe = property.getSelectrorPath({ parent: "entity", assignmentType: "FORCE_NULLABLE_OR_OPTIONAL" });
                objectBuilder.property(`${property.name}: ${entitySelectorPathSafe}`);
                return builder;
            }

            slotPath.push(...property.getParentPathArray());
            const nestedObjectBuilder = builder.get<ObjectBuilder>(slotPath.get());
            // Use optional chaining for nested properties to safely access
            const entitySelectorPathSafe = property.getSelectrorPath({ parent: "entity", assignmentType: "FORCE_NULLABLE_OR_OPTIONAL" });
            nestedObjectBuilder.property(`${property.name}: ${entitySelectorPathSafe}`);

            return builder;
        }

        return super.handle(property, builder);
    }
}

