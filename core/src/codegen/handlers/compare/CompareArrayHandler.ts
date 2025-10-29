import { AndBuilder, CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class CompareArrayHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Array) {
            let compare = builder.getOrDefault<AndBuilder>("result.variable.compare");
            const leftCompare = property.getSelectrorPath({ parent: "a" });
            const rightCompare = property.getSelectrorPath({ parent: "b" });

            if (compare == null) {
                compare = builder.get<SlotBlock>("result")
                    .assign("const result", { name: "variable" })
                    .and(`JSON.stringify(${leftCompare}) === JSON.stringify(${rightCompare})`, { name: "compareArray" });
                return builder;
            }

            compare.and(`JSON.stringify(${leftCompare}) === JSON.stringify(${rightCompare})`);
            return builder;
        }

        return super.handle(property, builder);
    }
}