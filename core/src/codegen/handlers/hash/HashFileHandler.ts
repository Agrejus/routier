import { CodeBuilder, SlotBlock, StringBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

/**
 * A file takes no part in the hash that correlates an addition with what came back.
 *
 * The hash exists to match a submitted entity against the row the database echoed, which is
 * why identity values are already excluded: the database assigns them, so they differ on the
 * two sides by design.
 *
 * A file is the same situation one step out. What is submitted is content; what is stored, and
 * echoed, is a reference. Hashing the VALUE produced two different hashes for the same
 * addition and the change tracker reported "Cannot find internal addition" on every save with
 * a file.
 *
 * It contributes a constant rather than nothing at all. The `result` string is created by
 * whichever handler runs first, so a schema whose only non-identity properties are files —
 * an assets row holding an original and a thumbnail, say — would emit no declaration and then
 * return it: `ReferenceError: result is not defined` at the first add. A constant keeps the
 * hash stable across the content-to-reference swap while still declaring the variable.
 */
export class HashFileHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.File) {
            let stringBuilder = builder.getOrDefault<StringBuilder>("hash-object-return.variable.string");

            if (stringBuilder == null) {
                stringBuilder = builder.get<SlotBlock>("hash-object-return")
                    .assign("const result", { name: "variable" })
                    .string("template", { name: "string" });
            }

            // The property's NAME, not its value: stable on both sides of the swap, and still
            // distinct from a schema that does not have this file at all.
            stringBuilder.append(`file:${property.name}`);

            return builder;
        }

        return super.handle(property, builder);
    }
}
