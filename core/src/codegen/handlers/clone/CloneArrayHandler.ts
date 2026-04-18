import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class CloneArrayHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Array) {

            if (property.isNullable || property.isOptional) {
                // Child properties will take care of this
                return builder;
            }

            const entitySelectorPath = property.getSelectrorPath({ parent: "entity" });

            const slot = builder.get<SlotBlock>("if");
            const resultAssignmentPath = property.getAssignmentPath({ parent: "result" });

            if (property.parent == null) {
                slot.if(`${entitySelectorPath} != null`).appendBody(`${resultAssignmentPath} = [...${entitySelectorPath}]`);
                return builder;
            }

            // Nested array: ensure parent exists, then assign spread copy (same pattern as CloneValueHandler)
            const parentPathArray = property.getParentPathArray();
            const ifSlot = slot.if(`${entitySelectorPath} != null`);

            for (let i = 0; i < parentPathArray.length; i++) {
                const pathSoFar = ["result", ...parentPathArray.slice(0, i + 1)].join(".");
                ifSlot.appendBody(`if (${pathSoFar} == null) ${pathSoFar} = {};`);
            }
            ifSlot.appendBody(`${resultAssignmentPath} = [...${entitySelectorPath}];`);
            return builder;
        }

        return super.handle(property, builder);
    }
}