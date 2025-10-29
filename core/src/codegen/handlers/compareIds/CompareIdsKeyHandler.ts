import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo } from "../../../schema";

export class CompareIdsKeyHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<unknown>, builder: CodeBuilder): CodeBuilder | null {

        if (property.isKey) {
            const slot = builder.get<SlotBlock>("ifs");
            const leftCompare = property.getSelectrorPath({ parent: "a" });
            const rightCompare = property.getSelectrorPath({ parent: "b" });

            slot.if(`${leftCompare} != ${rightCompare}`).appendBody("return false;");
            return builder;
        }

        return super.handle(property, builder);
    }
}