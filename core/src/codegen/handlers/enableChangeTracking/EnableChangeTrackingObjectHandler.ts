import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class EnableChangeTrackingObjectHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Object) {
            const assignmentSlot = builder.get<SlotBlock>("assignment");
            const childSelectorPath = property.getSelectrorPath({ parent: "entity" });
            const childAssignmentPath = property.getAssignmentPath({ parent: "entity" });

            // Pass the root as parent so nested writes mark the root entity dirty,
            // and the full dotted path so the change is recorded under it
            assignmentSlot.if(`${childSelectorPath} != null`).appendBody(`${childAssignmentPath} = enableChangeTracking(${childAssignmentPath}, "${this.getTrackingPath(property)}", entity);`);
            return builder;
        }

        return super.handle(property, builder);
    }
}