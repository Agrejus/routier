import { CodeBuilder, ContainerBlock, ObjectBuilder } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "@core/schema";

/**
 * Handles converting a string value from a database to a Date value
 */
export class DeserializeDateHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Date) {
            const slotPath = new SlotPath("result.variable.object");
            let objectBuilder = builder.get<ObjectBuilder>(slotPath.get());
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity" });
            const entityAssignmentPath = property.getAssignmentPath({ parent: "result" });
            const assignment = `${property.name}: typeof ${entitySelectorPath} === "string" ? new Date(${entitySelectorPath}) : ${entitySelectorPath}`;

            // if it is nullable or optional, assign in an if block, otherwise we 
            // could unintentionally assign null/undefined to a property that does not exist
            if (property.isOptional || property.isNullable) {
                const ifAssignment = `${entityAssignmentPath} = typeof ${entitySelectorPath} === "string" ? new Date(${entitySelectorPath}) : ${entitySelectorPath}`;
                const rootPath = new SlotPath("if");
                builder.get<ContainerBlock>(rootPath.get()).if(`${entitySelectorPath} != null`).appendBody(ifAssignment);
                return;
            }

            // A date cannot be a nested object, just do the assignment
            if (property.parent == null) {
                objectBuilder.property(assignment);

                return builder;
            }

            slotPath.push(...property.getParentPathArray());
            const nestedObjectBuilder = builder.get<ObjectBuilder>(slotPath.get());
            nestedObjectBuilder.property(assignment)

            return builder;
        }

        return super.handle(property, builder);
    }
}