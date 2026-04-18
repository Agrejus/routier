import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class CloneValueHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type != SchemaTypes.Object && property.type != SchemaTypes.Array) {
            const slot = builder.get<SlotBlock>("if");
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity" });
            const resultAssignmentPath = property.getAssignmentPath({ parent: "result" });

            if (property.parent == null) {
                // we are a first level property
                slot.if(`${entitySelectorPath} != null`).appendBody(`${resultAssignmentPath} = ${entitySelectorPath}`);
                return builder;
            }

            // Nested property: ensure every ancestor object exists, then assign (handles depth > 2)
            const parentPathArray = property.getParentPathArray();
            const ifSlot = slot.if(`${entitySelectorPath} != null`);

            for (let i = 0; i < parentPathArray.length; i++) {
                const pathSoFar = ["result", ...parentPathArray.slice(0, i + 1)].join(".");
                ifSlot.appendBody(`if (${pathSoFar} == null) ${pathSoFar} = {};`);
            }
            ifSlot.appendBody(`${resultAssignmentPath} = ${entitySelectorPath}`);
            return builder;
        }

        return super.handle(property, builder);
    }
}