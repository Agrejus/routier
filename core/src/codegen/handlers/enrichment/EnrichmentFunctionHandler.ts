import { CodeBuilder, FunctionFactoryBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class EnrichmentFunctionHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.functionBody != null && property.type === SchemaTypes.Function) {

            const factory = builder.get<FunctionFactoryBuilder>("factory");
            const args: string[] = ["enriched", "collectionName"];

            if (property.injected != null) {
                args.push(factory.bind(property.injected));
            }

            const slot = builder.get<SlotBlock>("factory.function.assignment");
            const enrichedAssignmentPath = property.getAssignmentPath({ parent: "enriched" });

            // The definition is curried: calling it with the entity returns the function the
            // property holds
            slot.assign(enrichedAssignmentPath).value(this.emitBoundCall(factory, property.functionBody, args));
            return builder;
        }

        return super.handle(property, builder);
    }
}
