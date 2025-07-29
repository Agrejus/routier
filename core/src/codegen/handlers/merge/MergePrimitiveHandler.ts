import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "@core/schema";

export class MergePrimitiveHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type != SchemaTypes.Object) {
            const selectorPath = property.getSelectrorPath({ parent: "source", assignmentType: "FORCE_NULLABLE_OR_OPTIONAL" });
            const slot = builder.get<SlotBlock>("factory.function.assignments");
            const entitySelectorPath = property.getAssignmentPath({ parent: "source" });
            const enrichedAssignmentPath = property.getAssignmentPath({ parent: "destination" });

            slot.if(`${selectorPath} != null`).appendBody(`${enrichedAssignmentPath} = ${entitySelectorPath}`);
            return builder;
        }

        return super.handle(property, builder);
    }
}