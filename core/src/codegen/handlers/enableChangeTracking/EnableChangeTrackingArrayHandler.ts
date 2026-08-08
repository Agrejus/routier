import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { isArrayValued, PropertyInfo } from "../../../schema";

/**
 * Arrays participate in change tracking: the array itself is wrapped in the tracking
 * proxy (with the root as parent) so in-place mutations — push/splice/index writes —
 * mark the root entity dirty instead of being silently lost on save.
 */
export class EnableChangeTrackingArrayHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (isArrayValued(property.type)) {
            const assignmentSlot = builder.get<SlotBlock>("assignment");
            const childSelectorPath = property.getSelectrorPath({ parent: "entity" });
            const childAssignmentPath = property.getAssignmentPath({ parent: "entity" });

            assignmentSlot.if(`${childSelectorPath} != null`).appendBody(`${childAssignmentPath} = enableChangeTracking(${childAssignmentPath}, "${this.getTrackingPath(property)}", entity);`);
            return builder;
        }

        return super.handle(property, builder);
    }
}
