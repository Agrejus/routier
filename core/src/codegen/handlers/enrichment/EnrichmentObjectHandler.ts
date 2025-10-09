import { CodeBuilder, ObjectBuilder, SlotBlock } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class EnrichmentObjectHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Object && (property.isNullable || property.isOptional) === false) {

            const slotPath = new SlotPath("factory", "function", "enriched", "object", "enriched");
            const nestedSlotPath = this.buildSlotPath(property, slotPath);

            // Generate null check for current level using parent relationships
            const enrichedPath = property.getAssignmentPath({ parent: "enriched" });

            const slot = builder.get<SlotBlock>("factory.function.assignment");

            slot.assign(enrichedPath).value(`enableChangeTracking(${enrichedPath} || {}, "${property.name}")`)

            let enriched = builder.getOrDefault<ObjectBuilder>(nestedSlotPath.get());

            if (enriched == null) {
                const enrichedSlot = builder.get<ObjectBuilder>(slotPath.get());

                if (enrichedSlot == null) {
                    throw new Error(`Error building enricher, could not find slot for ${slotPath.get()}`)
                }

                enriched = enrichedSlot.nested(property.name, `[${enrichedPath}]`);
            }
            return builder;
        }

        return super.handle(property, builder);
    }
}