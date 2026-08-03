import { CodeBuilder, SlotBlock, StringBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

/**
 * Hashes array contents via JSON — template interpolation of an array of
 * objects would collapse every value to "[object Object]" and collide.
 */
export class HashArrayHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Array) {
            let stringBuilder = builder.getOrDefault<StringBuilder>("hash-object-return.variable.string");
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity" });

            if (stringBuilder == null) {
                stringBuilder = builder.get<SlotBlock>("hash-object-return")
                    .assign("const result", { name: "variable" })
                    .string("template", { name: "string" });
            }

            stringBuilder.append("${JSON.stringify(" + entitySelectorPath + ")}")

            return builder;
        }

        return super.handle(property, builder);
    }
}
