import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

/**
 * Copies Date properties by value.  A reference copy would let a mutation of the
 * clone's Date (e.g. setHours) silently change the source entity.
 */
// See CloneValueHandler for why the guard is `!== undefined` (known-defects #66).
export class CloneDateHandler extends PropertyInfoHandler {

    /** See `CloneValueHandler`. */
    constructor(private readonly useFromPropertyName: boolean = false) {
        super();
    }

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Date) {
            const slot = builder.get<SlotBlock>("if");
            const useFromPropertyName = this.useFromPropertyName;
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity", useFromPropertyName });
            const resultAssignmentPath = property.getAssignmentPath({ parent: "result", useFromPropertyName });

            // Stored values can still be serialized strings; only wrap real Dates. A null falls
            // through this expression unchanged, which is what the `!== undefined` guard wants.
            const copyExpression = `${entitySelectorPath} instanceof Date ? new Date(${entitySelectorPath}.getTime()) : ${entitySelectorPath}`;

            if (property.parent == null) {
                slot.if(`${entitySelectorPath} !== undefined`).appendBody(`${resultAssignmentPath} = ${copyExpression}`);
                return builder;
            }

            // Nested property: ensure every ancestor object exists, then assign (same pattern as CloneValueHandler)
            const parentPathArray = property.getParentPathArray({ useFromPropertyName });
            const ifSlot = slot.if(`${entitySelectorPath} !== undefined`);

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
