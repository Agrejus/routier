import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { isArrayValued, PropertyInfo } from "../../../schema";

/**
 * Arrays participate in change tracking: the array itself is wrapped in the tracking
 * proxy (with the root as parent) so in-place mutations — push/splice/index writes —
 * mark the root entity dirty instead of being silently lost on save.
 */
export class EnrichmentArrayHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (isArrayValued(property.type)) {

            // Place the property in the enriched literal like any other leaf
            this.setEnrichedProperty(property, builder);

            const enrichedPath = property.getAssignmentPath({ parent: "enriched" });
            const ifsSlot = builder.get<SlotBlock>("factory.function.ifs");

            ifsSlot.if(`${enrichedPath} != null`).appendBody(`${enrichedPath} = enableChangeTracking(${enrichedPath}, "${this.getTrackingPath(property)}", enriched);`);

            return builder;
        }

        return super.handle(property, builder);
    }
}
