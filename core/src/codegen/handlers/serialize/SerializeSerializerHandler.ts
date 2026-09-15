import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo } from "../../../schema";

export class SerializeSerializerHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.valueSerializer != null) {
            const slot = builder.getOrDefault<SlotBlock>("if");
            // Serialize maps in-memory shape -> storage shape: read the entity by
            // property name, write the result by `from` (storage) name
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity" });
            const resultSelectorPath = property.getAssignmentPath({ parent: "result", useFromPropertyName: true });

            const call = this.emitBoundCall(builder, property.valueSerializer, [entitySelectorPath]);

            if (property.parent == null) {
                slot.if(`Object.hasOwn(entity, "${property.name}")`).appendBody(`${resultSelectorPath} = ${call}`);
                return builder;
            }

            // Nested serializer: same pattern as SerializeValueHandler — if block for parent existence, then assign via serializer
            this.emitSerializeNestedAssignment(property, slot, call);
            return builder;
        }

        return super.handle(property, builder);
    }
}
