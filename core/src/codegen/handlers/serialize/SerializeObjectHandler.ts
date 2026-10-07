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

            const optionalAncestor = nearestOptionalAncestor(property);

            if (optionalAncestor == null) {
                slot.assign(childPath).value("{}");
                return builder;
            }

            const ifSlot = slot.if(`${optionalAncestor.getSelectrorPath({ parent: "entity", assignmentType: "FORCE_NULLABLE_OR_OPTIONAL" })} != null`);
            this.emitDestinationAncestorGuards(property, ifSlot, { root: "result", useFromPropertyName: true });
            ifSlot.appendBody(`${childPath} = {}`);

            return builder;
        }

        return super.handle(property, builder);
    }
}

const nearestOptionalAncestor = (property: PropertyInfo<any>): PropertyInfo<any> | null => {
    for (let ancestor = property.parent; ancestor != null; ancestor = ancestor.parent) {
        if (ancestor.isNullable || ancestor.isOptional) {
            return ancestor;
        }
    }

    return null;
};
