import { CodeBuilder, ObjectBuilder, SlotBlock } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo } from "../../../schema";

export class DeserializeDeserializerHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.valueDeserializer != null) {
            let objectBuilder = builder.getOrDefault<ObjectBuilder>("result.variable.object");
            const assignmentBuilder = builder.getOrDefault<SlotBlock>("functions");
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity" });

            if (objectBuilder == null) {
                objectBuilder = builder.get<SlotBlock>("result")
                    .assign("const result", { name: "variable" })
                    .object({ name: "object" });
            }

            const defaultFunctionWithParameters = this.toNamedFunction(property.valueDeserializer.toString(), assignmentBuilder);
            defaultFunctionWithParameters.builder.parameters(...defaultFunctionWithParameters.parameters.map((_, i) => ({ name: defaultFunctionWithParameters.parameters[i], callName: entitySelectorPath })));

            if (property.parent == null) {
                objectBuilder.property(`${property.name}: ${defaultFunctionWithParameters.builder.toCallable()}`);
                return builder;
            }

            const slotPath = new SlotPath(...property.getParentPathArray());
            objectBuilder = objectBuilder.get<ObjectBuilder>(slotPath.get());
            objectBuilder.property(`${property.name}: ${defaultFunctionWithParameters.builder.toCallable()}`);
            return builder;
        }

        return super.handle(property, builder);
    }
}