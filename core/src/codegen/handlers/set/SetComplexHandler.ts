import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

const allowedTypes = new Set<SchemaTypes>([
    SchemaTypes.Array,
    SchemaTypes.Boolean,
    SchemaTypes.Date,
    SchemaTypes.Number,
    SchemaTypes.Object,
    SchemaTypes.String
]);

export class SetComplexHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (allowedTypes.has(property.type)) {
            const selectorPath = property.getSelectrorPath({ parent: "source", assignmentType: "FORCE_NULLABLE_OR_OPTIONAL" });
            const slot = builder.get<SlotBlock>("assignments");
            const entitySelectorPath = property.getAssignmentPath({ parent: "source" });
            const enrichedAssignmentPath = property.getAssignmentPath({ parent: "destination" });

            slot.if(`${selectorPath} != null`).appendBody(`${enrichedAssignmentPath} = ${entitySelectorPath}`);
            return builder;
        }

        return super.handle(property, builder);
    }
}