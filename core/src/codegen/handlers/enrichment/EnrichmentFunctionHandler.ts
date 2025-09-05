import { CodeBuilder, FunctionFactoryBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class EnrichmentFunctionHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.functionBody != null && property.type === SchemaTypes.Function) {

            const parameterNames: string[] = ["enriched", "collectionName"];

            if (property.injected != null) {

                const factory = builder.get<FunctionFactoryBuilder>("factory");
                const parameter = factory.createParameter(property.injected);
                factory.parameters(parameter);

                parameterNames.push(parameter.name);
            }


            const declarationsSlot = builder.get<SlotBlock>("factory.function.declarations");
            // Unwrap the functions to removing currying
            const defaultFunctionWithParameters = this.toNamedFunction(property.functionBody.toString(), declarationsSlot);

            defaultFunctionWithParameters.builder.parameters(...parameterNames.map((w, i) => ({ name: defaultFunctionWithParameters.parameters[i], callName: w })));

            const slot = builder.get<SlotBlock>("factory.function.assignment");
            const enrichedAssignmentPath = property.getAssignmentPath({ parent: "enriched" });

            slot.assign(enrichedAssignmentPath).value(defaultFunctionWithParameters.builder.toCallable());
            return builder;
        }

        return super.handle(property, builder);
    }
}