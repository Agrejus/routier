import { CodeBuilder, FunctionFactoryBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class MergeComputedValueHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.functionBody != null && property.type === SchemaTypes.Computed) {
            const parameterNames: string[] = ["source", "collectionName"];

            if (property.injected != null) {

                const factory = builder.get<FunctionFactoryBuilder>("factory");
                const parameter = factory.createParameter(property.injected);
                factory.parameters(parameter);

                parameterNames.push(parameter.name);
            }

            const declarationsSlot = builder.get<SlotBlock>("factory.function.header");
            const defaultFunctionWithParameters = this.toNamedFunction(property.functionBody.toString(), declarationsSlot);

            defaultFunctionWithParameters.builder.parameters(...parameterNames.map((w, i) => ({ name: defaultFunctionWithParameters.parameters[i], callName: w })));

            const slot = builder.get<SlotBlock>("factory.function.assignments");
            const enrichedAssignmentPath = property.getAssignmentPath({ parent: "destination" });

            // We want to recompute the value always in case there are changes
            slot.assign(enrichedAssignmentPath).value(defaultFunctionWithParameters.builder.toCallable());

            return builder;
        }

        return super.handle(property, builder);
    }
}