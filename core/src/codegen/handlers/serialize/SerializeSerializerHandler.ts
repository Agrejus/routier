import { CodeBuilder, ObjectBuilder, SlotBlock } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo } from "../../../schema";

export class SerializeSerializerHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.valueSerializer != null) {
            const objectBuilder = builder.getOrDefault<SlotBlock>("if");
            const assignmentBuilder = builder.getOrDefault<SlotBlock>("functions");
            const entitySelectorPath = property.getAssignmentPath({ parent: "entity" });
            const resultSelectorPath = property.getAssignmentPath({ parent: "result" });

            const defaultFunctionWithParameters = this.toNamedFunction(property.valueSerializer.toString(), assignmentBuilder);
            defaultFunctionWithParameters.builder.parameters(...defaultFunctionWithParameters.parameters.map((_, i) => ({ name: defaultFunctionWithParameters.parameters[i], callName: entitySelectorPath })));

            if (property.parent == null) {
                objectBuilder.if(`Object.hasOwn(entity, "${property.name}")`).appendBody(`${resultSelectorPath} = ${defaultFunctionWithParameters.builder.toCallable()}`)
                return builder;
            }

            debugger;
            // TODO: SOLVE THIS
            //const slotPath = new SlotPath(...property.getParentPathArray());

            // const slotPath = new SlotPath(...property.getParentPathArray());
            // objectBuilder = objectBuilder.get<ObjectBuilder>(slotPath.get());
            // objectBuilder.property(`${property.name}: ${defaultFunctionWithParameters.builder.toCallable()}`);
            return builder;
        }

        return super.handle(property, builder);
    }
}