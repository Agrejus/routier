import { CodeBuilder, SlotBlock, StringBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo } from "../../../schema";

/**
 * A transformed property takes no part in the hash that correlates an addition with its echo.
 *
 * The hash matches a submitted entity against the row the database echoed, which is why
 * identity values are already excluded: the database assigns them, so the two sides differ by
 * design.
 *
 * A transform is the same situation. What is submitted is the application value and what is
 * stored is the transformed one, and a ONE-WAY transform — no `from` — never converts back, so
 * the echo legitimately differs and every save reported "Cannot find internal addition". A
 * two-way transform happens to restore the value before the comparison, but relying on that
 * would make correlation depend on whether a caller supplied `from`.
 *
 * It contributes the property NAME rather than nothing, so a schema whose only non-identity
 * properties are transformed still declares the `result` string the generated function
 * returns.
 */
export class HashTransformHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.transform != null) {
            let stringBuilder = builder.getOrDefault<StringBuilder>("hash-object-return.variable.string");

            if (stringBuilder == null) {
                stringBuilder = builder.get<SlotBlock>("hash-object-return")
                    .assign("const result", { name: "variable" })
                    .string("template", { name: "string" });
            }

            stringBuilder.append(`transform:${property.name}`);

            return builder;
        }

        return super.handle(property, builder);
    }
}
