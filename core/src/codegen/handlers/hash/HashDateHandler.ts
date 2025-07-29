import { CodeBuilder, SlotBlock, StringBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "@core/schema";

export class HashDateHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Date) {
            let stringBuilder = builder.getOrDefault<StringBuilder>("hash-object-return.variable.string");
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity" });

            if (stringBuilder == null) {
                stringBuilder = builder.get<SlotBlock>("hash-object-return")
                    .assign("const result", { name: "variable" })
                    .string("template", { name: "string" });
            }

            stringBuilder.append("${stringifyDate(" + entitySelectorPath + ")}")

            return builder;
        }

        return super.handle(property, builder);
    }
}