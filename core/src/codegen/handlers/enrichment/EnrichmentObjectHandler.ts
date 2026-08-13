import { CodeBuilder, ObjectBuilder, SlotBlock } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class EnrichmentObjectHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Object && (property.isNullable || property.isOptional) === false) {

            const slotPath = new SlotPath("factory", "function", "enriched", "object", "enriched");
            const nestedSlotPath = this.buildEnrichedObjectSlotPath(property, slotPath);

            // Generate null check for current level using parent relationships
            const enrichedPath = property.getAssignmentPath({ parent: "enriched" });

            const slot = builder.get<SlotBlock>("factory.function.assignment");

            // Pass the root as parent so nested writes mark the root entity dirty,
            // and the full dotted path so the change is recorded under it
            slot.assign(enrichedPath).value(`enableChangeTracking(${enrichedPath} || {}, "${this.getTrackingPath(property)}", enriched)`)

            let enriched = builder.getOrDefault<ObjectBuilder>(nestedSlotPath.get());

            if (enriched == null) {
                if (property.parent != null) {
                    // Nested object: attach to the parent's ObjectBuilder (registered as
                    // `[enriched.<parentPath>]`), never to the root — attaching to the root
                    // hoists the subtree to the top level of the literal
                    const parentSlotPath = this.buildEnrichedObjectSlotPath(property.parent, slotPath);
                    const parentBuilder = builder.get<ObjectBuilder>(parentSlotPath.get());
                    enriched = parentBuilder.nested(property.name, `[${enrichedPath}]`);
                } else {
                    // Create the enriched result object when this is the first property
                    // iterated — handler output cannot depend on schema property order
                    let enrichedRoot = builder.getOrDefault<ObjectBuilder>(slotPath.get());

                    if (enrichedRoot == null) {
                        const enrichedSlot = builder.get<SlotBlock>("factory.function.enriched");
                        enrichedRoot = enrichedSlot.variable("enriched", { name: "object" }).object({ name: "enriched" });
                    }

                    enriched = enrichedRoot.nested(property.name, `[${enrichedPath}]`);
                }
            }
            return builder;
        }

        return super.handle(property, builder);
    }
}