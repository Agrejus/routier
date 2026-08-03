import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class CloneArrayHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Array) {

            // Arrays are leaf properties — they have no child PropertyInfos, so the
            // copy must happen here for every array, including nullable/optional ones.
            // The `!= null` guard below covers absent values.
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity" });

            const slot = builder.get<SlotBlock>("if");
            const resultAssignmentPath = property.getAssignmentPath({ parent: "result" });

            // Primitive elements copy with a spread; anything that can hold nested
            // references (objects, dates, nested arrays) needs a deep copy or the
            // clone shares element references with the source. Dates get an explicit
            // per-element copy rather than structuredClone: structuredClone can return
            // Dates from a foreign realm (e.g. under jest), which fail `instanceof Date`.
            const elementType = property.innerSchema?.type;
            const isPrimitiveElement = elementType === SchemaTypes.String ||
                elementType === SchemaTypes.Number ||
                elementType === SchemaTypes.Boolean;
            let copyExpression: string;
            if (isPrimitiveElement) {
                copyExpression = `[...${entitySelectorPath}]`;
            } else if (elementType === SchemaTypes.Date) {
                copyExpression = `${entitySelectorPath}.map(function (v) { return v == null ? v : new Date(v); })`;
            } else {
                copyExpression = `structuredClone(${entitySelectorPath})`;
            }

            if (property.parent == null) {
                slot.if(`${entitySelectorPath} != null`).appendBody(`${resultAssignmentPath} = ${copyExpression}`);
                return builder;
            }

            // Nested array: ensure parent exists, then assign the copy (same pattern as CloneValueHandler)
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