import { CodeBuilder, ObjectBuilder, SlotBlock } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo } from "../../../schema";

export class DeserializeDeserializerHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.valueDeserializer != null) {
            let objectBuilder = builder.getOrDefault<ObjectBuilder>("result.variable.object");
            // Read the incoming record by `from` (storage) name
            const entitySelectorPath = property.getSelectrorPath({ parent: "unserialized", useFromPropertyName: true });

            if (objectBuilder == null) {
                objectBuilder = builder.get<SlotBlock>("result")
                    .assign("const entity", { name: "variable" })
                    .object({ name: "object" });
            }

            const call = this.emitBoundCall(builder, property.valueDeserializer, [entitySelectorPath]);

            if (property.parent == null) {
                objectBuilder.property(`${property.name}: ${call}`);
                return builder;
            }

            const slotPath = new SlotPath(...property.getParentPathArray());
            objectBuilder = objectBuilder.get<ObjectBuilder>(slotPath.get());
            objectBuilder.property(`${property.name}: ${call}`);
            return builder;
        }

        return super.handle(property, builder);
    }
}
