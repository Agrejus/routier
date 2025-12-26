import { CodeBuilder, ObjectBuilder, SlotBlock } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class EnrichmentArrayHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Array) {
            const slotPath = new SlotPath("factory", "function", "enriched", "object", "enriched");
            const nestedSlotPath = this.buildSlotPath(property, slotPath);
            const enrichedPath = property.getAssignmentPath({ parent: "enriched" });
            const entityPath = property.getSelectrorPath({ parent: "entity", assignmentType: property.isNullable || property.isOptional ? "FORCE_NULLABLE_OR_OPTIONAL" : undefined });

            const isArrayOfObjects = property.children.length > 0;
            const mapCode = isArrayOfObjects
                ? `${entityPath}.map(item => typeof item === 'object' && item !== null && !Array.isArray(item) ? enableChangeTracking(item, "${property.name}") : item)`
                : `${entityPath}`;

            if (property.isNullable || property.isOptional) {
                const ifsSlot = builder.get<SlotBlock>("factory.function.ifs");
                if (ifsSlot == null) {
                    throw new Error("Error building enricher, could not find slot for factory.function.ifs");
                }
                ifsSlot.if(`${entityPath} != null`).appendBody(`${enrichedPath} = ${entityPath} != null ? ${mapCode} : null;`);
            } else {
                const slot = builder.get<SlotBlock>("factory.function.assignment");
                slot.assign(enrichedPath).value(`${entityPath} != null ? ${mapCode} : []`);
            }

            let enriched = builder.getOrDefault<ObjectBuilder>(nestedSlotPath.get());
            if (enriched == null) {
                const enrichedSlot = builder.get<ObjectBuilder>(slotPath.get());
                if (enrichedSlot == null) {
                    throw new Error(`Error building enricher, could not find slot for ${slotPath.get()}`);
                }
                enriched = enrichedSlot.nested(property.name, `[${enrichedPath}]`);
            }

            return builder;
        }

        return super.handle(property, builder);
    }
}

