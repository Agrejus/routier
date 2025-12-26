import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class MergePrimitiveHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type != SchemaTypes.Object) {
            const selectorPath = property.getSelectrorPath({ parent: "source", assignmentType: "FORCE_NULLABLE_OR_OPTIONAL" });
            const slot = builder.get<SlotBlock>("factory.function.assignments");
            const enrichedAssignmentPath = property.getAssignmentPath({ parent: "destination" });

            // Use selectorPath for both check and assignment to safely handle nested/optional properties
            // Check for !== undefined to allow overwriting with null, 0, false, empty string, etc.
            slot.if(`${selectorPath} !== undefined`).appendBody(`${enrichedAssignmentPath} = ${selectorPath}`);
            return builder;
        }

        return super.handle(property, builder);
    }
}