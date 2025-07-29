import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo } from "@core/schema";

export class PrepareKeyHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.isKey === true) {
            const selectorPath = property.getSelectrorPath({ parent: "entity", assignmentType: "FORCE_NULLABLE_OR_OPTIONAL" });
            const slot = builder.get<SlotBlock>("assignments");
            const entitySelectorPath = property.getAssignmentPath({ parent: "entity" });
            const enrichedAssignmentPath = property.getAssignmentPath({ parent: "result" });

            slot.if(`${selectorPath} != null`).appendBody(`${enrichedAssignmentPath} = ${entitySelectorPath}`);
            return builder;
        }

        return super.handle(property, builder);
    }
}