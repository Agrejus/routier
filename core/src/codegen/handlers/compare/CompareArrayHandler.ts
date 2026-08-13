import { AndBuilder, CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { isArrayValued, PropertyInfo } from "../../../schema";

export class CompareArrayHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (isArrayValued(property.type)) {
            let compare = builder.getOrDefault<AndBuilder>("result.variable.compare");
            const leftCompare = property.getSelectrorPath({ parent: "a" });
            const rightCompare = property.getSelectrorPath({ parent: "b" });

            if (compare == null) {
                compare = builder.get<SlotBlock>("result")
                    .assign("const result", { name: "variable" })
                    // Named "compare" so every compare handler finds the same block
                    // regardless of which property type is iterated first
                    .and(`JSON.stringify(${leftCompare}) === JSON.stringify(${rightCompare})`, { name: "compare" });
                return builder;
            }

            compare.and(`JSON.stringify(${leftCompare}) === JSON.stringify(${rightCompare})`);
            return builder;
        }

        return super.handle(property, builder);
    }
}