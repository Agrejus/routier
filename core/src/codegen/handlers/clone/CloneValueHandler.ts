import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { isArrayValued, PropertyInfo, SchemaTypes } from "../../../schema";

/**
 * `!== undefined`, not `!= null`.
 *
 * An explicit `null` is a VALUE and has to survive the copy; an absent or `undefined` property is
 * not there and must not be invented. The loose guard conflated the two and dropped every null,
 * which is how a `s.string().nullable()` written as `null` came back as `undefined` from the
 * memory family — see known-defects #66. It was invisible for a long time because the change
 * tracker merges a read into the canonical entity the caller still holds, so the null appeared to
 * survive right up until something read storage without one (a join).
 */
export class CloneValueHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        // Anything that copies by assignment. An array-valued property must not land here:
        // assigning the reference shares it with the source, which is the whole point of
        // CloneArrayHandler.
        if (property.type != SchemaTypes.Object && isArrayValued(property.type) === false) {
            const slot = builder.get<SlotBlock>("if");
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity" });
            const resultAssignmentPath = property.getAssignmentPath({ parent: "result" });

            if (property.parent == null) {
                // we are a first level property
                slot.if(`${entitySelectorPath} !== undefined`).appendBody(`${resultAssignmentPath} = ${entitySelectorPath}`);
                return builder;
            }

            // Nested property: ensure every ancestor object exists, then assign (handles depth > 2)
            const parentPathArray = property.getParentPathArray();
            const ifSlot = slot.if(`${entitySelectorPath} !== undefined`);

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