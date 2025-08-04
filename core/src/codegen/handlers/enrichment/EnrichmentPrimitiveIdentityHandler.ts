import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class EnrichmentPrimitiveIdentityHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.isIdentity === true && property.type != SchemaTypes.Object) {
            const selectorPath = property.getSelectrorPath({ parent: "entity", assignmentType: "FORCE_NULLABLE_OR_OPTIONAL" });
            const slot = builder.get<SlotBlock>("factory.function.ifs");
            const entitySelectorPath = property.getAssignmentPath({ parent: "entity" });
            const enrichedAssignmentPath = property.getAssignmentPath({ parent: "enriched" });

            slot.if(`${selectorPath} != null`).appendBody(`${enrichedAssignmentPath} = ${entitySelectorPath}`);
            return builder;
        }

        return super.handle(property, builder);
    }
}