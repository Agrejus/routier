import { CodeBuilder, FunctionFactoryBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo } from "../../../schema";

export class EnrichmentDefaultFunctionHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.defaultValue != null && typeof property.defaultValue === "function") {

            this.setEnrichedProperty(property, builder);

            const factory = builder.get<FunctionFactoryBuilder>("factory");
            // Defaults take at most one argument: the injected value, when there is one
            const args = property.injected != null ? [factory.bind(property.injected)] : [];
            const call = this.emitBoundCall(factory, property.defaultValue, args);

            const ifsSlot = builder.get<SlotBlock>("factory.function.ifs");
            const enrichedAssignmentPath = property.getAssignmentPath({ parent: "enriched" });
            ifsSlot.if(`${enrichedAssignmentPath} == null`).appendBody(`${enrichedAssignmentPath} = ${call}`);

            return builder;
        }

        return super.handle(property, builder);
    }
}
