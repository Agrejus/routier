import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class MergeArrayHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Array) {
            const selectorPath = property.getSelectrorPath({ parent: "source", assignmentType: "FORCE_NULLABLE_OR_OPTIONAL" });
            const slot = builder.get<SlotBlock>("factory.function.assignments");
            const sourcePath = property.getAssignmentPath({ parent: "source" });
            const destinationPath = property.getAssignmentPath({ parent: "destination" });

            const isArrayOfObjects = property.children.length > 0;
            const mergeCode = isArrayOfObjects
                ? `${sourcePath} != null ? JSON.parse(JSON.stringify(${sourcePath})) : ${destinationPath}`
                : `${sourcePath} != null ? [...${sourcePath}] : ${destinationPath}`;

            slot.if(`${selectorPath} != null`).appendBody(`${destinationPath} = ${mergeCode};`);
            return builder;
        }

        return super.handle(property, builder);
    }
}

