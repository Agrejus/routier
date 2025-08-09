import { CodeBuilder, FunctionFactoryBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo } from "../../../schema";

export class MergeDefaultValueHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.defaultValue != null && typeof property.defaultValue !== "function") {
            const defaultFunctionParameters: string[] = [];

            if (property.injected != null) {
                const factory = builder.get<FunctionFactoryBuilder>("factory");
                const parameter = factory.createParameter(property.injected);
                factory.parameters(parameter);

                defaultFunctionParameters.push(parameter.name);
            }

            const ifsSlot = builder.get<SlotBlock>("factory.function.ifs");
            // we only want to run if the destination is null
            const selectorPath = property.getSelectrorPath({ parent: "destination" });
            const assignmentPath = property.getAssignmentPath({ parent: "destination" });

            ifsSlot.if(`${selectorPath} == null`).appendBody(`${assignmentPath} = ${typeof property.defaultValue === "string" ? `"${property.defaultValue}"` : property.defaultValue}`);

            return builder;
        }

        return super.handle(property, builder);
    }
}