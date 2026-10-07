import { CodeBuilder, SlotBlock } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";
export class SerializeObjectHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Object) {
            const slotPath = new SlotPath("assignments");
            const childPath = property.getAssignmentPath({
                parent: "result",
                useFromPropertyName: true
            });

            const slot = builder.get<SlotBlock>(slotPath.get());

            if (property.isNullable || property.isOptional) {
                const entityPath = property.getAssignmentPath({ parent: "entity" });
                const keepsNull = `${entityPath} == null ? ${entityPath} : {}`;

                if (property.parent == null) {
                    slot.if(`Object.hasOwn(entity, "${property.name}")`).appendBody(`${childPath} = ${keepsNull}`);
                    return builder;
                }

                this.emitSerializeNestedAssignment(property, slot, keepsNull);
                return builder;
            }

            slot.assign(`${childPath}`, { name: `[${childPath}]` }).value("{}");

            return builder;
        }

        return super.handle(property, builder);
    }
}