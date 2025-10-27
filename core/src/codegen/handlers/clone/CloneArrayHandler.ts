import { CodeBuilder, IfBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class CloneArrayHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Array) {

            if (property.isNullable || property.isOptional) {
                // Child properties will take care of this
                return builder;
            }

            const entitySelectorPath = property.getSelectrorPath({ parent: "entity" });

            if (property.parent == null) {

                const resultAssignmentPath = property.getAssignmentPath({ parent: "result" });
                const slot = builder.get<SlotBlock>("if");

                slot.if(`${entitySelectorPath} != null`).appendBody(`${resultAssignmentPath} = [...${entitySelectorPath}]`);
                return builder;
            }
            // slotPath.push(...property.getParentPathArray());
            // const nestedObjectBuilder = builder.get<ObjectBuilder>(slotPath.get());
            // nestedObjectBuilder.nested(property.name, property.name)

            return builder;
        }

        return super.handle(property, builder);
    }
}