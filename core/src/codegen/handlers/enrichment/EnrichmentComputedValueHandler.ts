import { CodeBuilder, FunctionFactoryBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class EnrichmentComputedValueHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.functionBody != null && property.type === SchemaTypes.Computed) {

            const factory = builder.get<FunctionFactoryBuilder>("factory");
            const args: string[] = ["enriched", "collectionName"];

            if (property.injected != null) {
                args.push(factory.bind(property.injected));
            }

            const call = this.emitBoundCall(factory, property.functionBody, args);

            // Compute-once semantics for computed keys/identities: an existing value is
            // carried into the enriched literal and never recomputed — a key must stay
            // stable once assigned (content-hash ids would otherwise churn as the
            // entity's shape moves through pipeline stages). Non-key computed props keep
            // recompute-per-enrich behavior: their value is derived presentation data
            if (property.isKey === true || property.isIdentity === true) {
                this.setEnrichedProperty(property, builder);
            }

            const ifsSlot = builder.get<SlotBlock>("factory.function.ifs");
            const enrichedAssignmentPath = property.getAssignmentPath({ parent: "enriched" });
            ifsSlot.if(`${enrichedAssignmentPath} == null`).appendBody(`${enrichedAssignmentPath} = ${call}`);

            return builder;
        }

        return super.handle(property, builder);
    }
}
