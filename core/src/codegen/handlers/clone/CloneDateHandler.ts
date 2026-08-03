import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

/**
 * Copies Date properties by value.  A reference copy would let a mutation of the
 * clone's Date (e.g. setHours) silently change the source entity.
 */
export class CloneDateHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Date) {
            const slot = builder.get<SlotBlock>("if");
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity" });
            const resultAssignmentPath = property.getAssignmentPath({ parent: "result" });

            // Stored values can still be serialized strings; only wrap real Dates
            const copyExpression = `${entitySelectorPath} instanceof Date ? new Date(${entitySelectorPath}.getTime()) : ${entitySelectorPath}`;

            if (property.parent == null) {
                slot.if(`${entitySelectorPath} != null`).appendBody(`${resultAssignmentPath} = ${copyExpression}`);
                return builder;
            }

            // Nested property: ensure every ancestor object exists, then assign (same pattern as CloneValueHandler)
            const parentPathArray = property.getParentPathArray();
            const ifSlot = slot.if(`${entitySelectorPath} != null`);

            for (let i = 0; i < parentPathArray.length; i++) {
                const pathSoFar = ["result", ...parentPathArray.slice(0, i + 1)].join(".");
                ifSlot.appendBody(`if (${pathSoFar} == null) ${pathSoFar} = {};`);
            }
            ifSlot.appendBody(`${resultAssignmentPath} = ${copyExpression};`);
            return builder;
        }

        return super.handle(property, builder);
    }
}
