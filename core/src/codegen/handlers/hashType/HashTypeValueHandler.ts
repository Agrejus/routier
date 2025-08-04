import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo } from "../../../schema";

export class HashTypeValueHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.isKey && property.isIdentity) {
            const slot = builder.get<SlotBlock>("ifs");
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity" });

            slot.if(`${entitySelectorPath} == null`).appendBody(`return "Object"`);

            return builder;
        }

        return super.handle(property, builder);
    }
}