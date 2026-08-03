import { CodeBuilder, IfBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo } from "../../../schema";

export class SerializeSerializerHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.valueSerializer != null) {
            const slot = builder.getOrDefault<SlotBlock>("if");
            const assignmentBuilder = builder.getOrDefault<SlotBlock>("functions");
            // Serialize maps in-memory shape -> storage shape: read the entity by
            // property name, write the result by `from` (storage) name
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity" });
            const resultSelectorPath = property.getAssignmentPath({ parent: "result", useFromPropertyName: true });

            const defaultFunctionWithParameters = this.toNamedFunction(property.valueSerializer.toString(), assignmentBuilder);
            defaultFunctionWithParameters.builder.parameters(...defaultFunctionWithParameters.parameters.map((_, i) => ({ name: defaultFunctionWithParameters.parameters[i], callName: entitySelectorPath })));

            if (property.parent == null) {
                slot.if(`Object.hasOwn(entity, "${property.name}")`).appendBody(`${resultSelectorPath} = ${defaultFunctionWithParameters.builder.toCallable()}`);
                return builder;
            }

            // Nested serializer: same pattern as SerializeValueHandler — if block for parent existence, then assign via serializer
            const parentSelectPath = ["entity", ...property.getParentPathArray()].join(".");
            const parentAssignPath = ["result", ...property.getParentPathArray({ useFromPropertyName: true })].join(".");
            const ifSlot = slot.if(`${parentSelectPath} != null && Object.hasOwn(${parentSelectPath}, "${property.name}")`);

            if (property.parent.isNullable || property.parent.isOptional) {
                const conditionallyCreateParent = new IfBuilder(`${parentAssignPath} == null`).appendBody(`${parentAssignPath} = {}`);
                ifSlot.appendBody(conditionallyCreateParent.toString());
            }

            ifSlot.appendBody(`${resultSelectorPath} = ${defaultFunctionWithParameters.builder.toCallable()}`);
            return builder;
        }

        return super.handle(property, builder);
    }
}