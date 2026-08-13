import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { hasPrimitiveElements, isArrayValued, PropertyInfo, SchemaTypes } from "../../../schema";

export class CloneArrayHandler extends PropertyInfoHandler {

    /** See `CloneValueHandler`. */
    constructor(private readonly useFromPropertyName: boolean = false) {
        super();
    }

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (isArrayValued(property.type)) {

            // Arrays are leaf properties — they have no child PropertyInfos, so the
            // copy must happen here for every array, including nullable/optional ones.
            // The `!== undefined` guard below covers absent values; an explicit null is copied as
            // null (see CloneValueHandler and known-defects #66), which is why every copy
            // expression is wrapped rather than applied directly — `[...null]` throws.
            const useFromPropertyName = this.useFromPropertyName;
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity", useFromPropertyName });

            const slot = builder.get<SlotBlock>("if");
            const resultAssignmentPath = property.getAssignmentPath({ parent: "result", useFromPropertyName });

            // Primitive elements copy with a spread; anything that can hold nested
            // references (objects, dates, nested arrays) needs a deep copy or the
            // clone shares element references with the source. Dates get an explicit
            // per-element copy rather than structuredClone: structuredClone can return
            // Dates from a foreign realm (e.g. under jest), which fail `instanceof Date`.
            // Deep copies go per ELEMENT, never structuredClone on the array itself: a
            // change-tracked entity's array is wrapped in a Proxy (and stays wrapped
            // across merges), and a Proxy cannot pass a structured-clone boundary.
            const elementType = property.innerSchema?.type;
            let copyExpression: string;
            if (hasPrimitiveElements(property.type, elementType)) {
                copyExpression = `[...${entitySelectorPath}]`;
            } else if (elementType === SchemaTypes.Date) {
                copyExpression = `${entitySelectorPath}.map(function (v) { return v == null ? v : new Date(v); })`;
            } else {
                copyExpression = `${entitySelectorPath}.map(function (v) { return v == null ? v : structuredClone(v); })`;
            }

            // A null array is still a null, not an empty one, and neither spread nor map survives it
            const nullSafeCopy = `${entitySelectorPath} === null ? null : ${copyExpression}`;

            if (property.parent == null) {
                slot.if(`${entitySelectorPath} !== undefined`).appendBody(`${resultAssignmentPath} = ${nullSafeCopy}`);
                return builder;
            }

            // Nested array: ensure parent exists, then assign the copy (same pattern as CloneValueHandler)
            const parentPathArray = property.getParentPathArray({ useFromPropertyName });
            const ifSlot = slot.if(`${entitySelectorPath} !== undefined`);

            for (let i = 0; i < parentPathArray.length; i++) {
                const pathSoFar = ["result", ...parentPathArray.slice(0, i + 1)].join(".");
                ifSlot.appendBody(`if (${pathSoFar} == null) ${pathSoFar} = {};`);
            }
            ifSlot.appendBody(`${resultAssignmentPath} = ${nullSafeCopy};`);
            return builder;
        }

        return super.handle(property, builder);
    }
}