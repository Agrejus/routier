import { CodeBuilder, FunctionFactoryBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class MergeComputedValueHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.functionBody != null && property.type === SchemaTypes.Computed) {
            const factory = builder.get<FunctionFactoryBuilder>("factory");
            const args: string[] = ["source", "collectionName"];

            if (property.injected != null) {
                args.push(factory.bind(property.injected));
            }

            const slot = builder.get<SlotBlock>("factory.function.assignments");
            const enrichedAssignmentPath = property.getAssignmentPath({ parent: "destination" });

            // We want to recompute the value always in case there are changes
            slot.assign(enrichedAssignmentPath).value(this.emitBoundCall(factory, property.functionBody, args));

            return builder;
        }

        return super.handle(property, builder);
    }
}
