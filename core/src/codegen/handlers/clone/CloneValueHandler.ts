import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class CloneValueHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type != SchemaTypes.Object && property.type != SchemaTypes.Array) {
            const slot = builder.getOrDefault<SlotBlock>("if");
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity" });
            const resultAssignmentPath = property.getAssignmentPath({ parent: "result" });

            if (property.parent == null) {
                // we are a first level property
                slot.if(`${entitySelectorPath} != null`).appendBody(`${resultAssignmentPath} = ${entitySelectorPath}`);
                return builder;
            }

            if (property.hasNullableParents) {
                debugger;
                return builder;
            }

            // Second level or more property
            // Assignment here is ok, because the parent cannot be null in practice
            slot.if(`${entitySelectorPath} != null`).appendBody(`${resultAssignmentPath} = ${entitySelectorPath}`);
            return builder;
        }

        return super.handle(property, builder);
    }
}