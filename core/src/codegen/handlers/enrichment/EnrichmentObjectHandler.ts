import { CodeBuilder, IfBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class EnrichmentObjectHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Object && (property.isNullable || property.isOptional) === false) {
            const assignmentSlot = builder.get<SlotBlock>("factory.function.assignment");
            const childPath = property.getAssignmentPath({ parent: "enriched" });

            if (assignmentSlot == null) {
                throw new Error("Error building enricher, could not find slot for factory.function.assignment")
            }

            assignmentSlot.assign(childPath, { name: `[${childPath}]` }).call("enableChangeTracking", { name: "builder" });

            const changeTrackingSlot = builder.get<IfBuilder>("factory.function.tracking.freeze");

            const selectorPath = property.getSelectrorPath({ parent: "enriched" });
            changeTrackingSlot.if(`${selectorPath} != null`, { unshift: true }).unshiftBody(`${selectorPath} = Object.freeze(${selectorPath})`)

            return builder;
        }

        return super.handle(property, builder);
    }
}