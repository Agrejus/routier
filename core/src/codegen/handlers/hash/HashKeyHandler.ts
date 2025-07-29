import { CodeBuilder, SlotBlock, StringBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo } from "@core/schema";

export class HashKeyHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.isKey === true) {
            let stringBuilder = builder.getOrDefault<StringBuilder>("hash-id-if.if-body.variable.string");
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity" });

            if (stringBuilder == null) {
                stringBuilder = builder.get<SlotBlock>("hash-id-if.if-body")
                    .assign("const result", { name: "variable" })
                    .string("template", { name: "string" });
            }

            stringBuilder.append("${" + entitySelectorPath + "}")

            return builder;
        }

        return super.handle(property, builder);
    }
}