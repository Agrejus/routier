import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { isArrayValued, PropertyInfo } from "../../../schema";

export class FreezeArrayHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (isArrayValued(property.type)) {
            const assignmentSlot = builder.get<SlotBlock>("assignment");
            const childSelectorPath = property.getSelectrorPath({ parent: "entity" });
            const childAssignmentPath = property.getAssignmentPath({ parent: "entity" });

            assignmentSlot.if(`${childSelectorPath} != null`).unshiftBody(`${childAssignmentPath} = Object.freeze(${childAssignmentPath});`);
            return builder;
        }

        return super.handle(property, builder);
    }
}
