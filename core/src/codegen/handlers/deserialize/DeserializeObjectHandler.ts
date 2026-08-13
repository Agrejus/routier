import { CodeBuilder, ObjectBuilder, SlotBlock } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class DeserializeObjectHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Object) {
            const slotPath = new SlotPath("result.variable.object");

            // Create the result object when this is the first property iterated —
            // handler output cannot depend on schema property order
            let objectBuilder = builder.getOrDefault<ObjectBuilder>(slotPath.get());

            if (objectBuilder == null) {
                objectBuilder = builder.get<SlotBlock>("result")
                    .assign("const entity", { name: "variable" })
                    .object({ name: "object" });
            }

            // The output entity is the in-memory shape — its keys are property
            // names; `from` names only appear on the unserialized (read) side
            if (property.parent == null) {
                objectBuilder.nested(property.name, property.name)

                return builder;
            }

            slotPath.push(...property.getParentPathArray());
            const nestedObjectBuilder = builder.get<ObjectBuilder>(slotPath.get());
            nestedObjectBuilder.nested(property.name, property.name)

            return builder;
        }

        return super.handle(property, builder);
    }
}