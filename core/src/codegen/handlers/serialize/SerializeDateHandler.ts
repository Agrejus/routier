import { CodeBuilder, ContainerBlock, ObjectBuilder } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

/**
 * Handles converting a Date value from JavaScript to a string value
 */
export class SerializeDateHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Date) {
            const slotPath = new SlotPath("result.variable.object");
            let objectBuilder = builder.get<ObjectBuilder>(slotPath.get());
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity" });
            const entityAssignmentPath = property.getAssignmentPath({ parent: "result" });
            const assignment = `${property.name}: ${entitySelectorPath} instanceof Date ? ${entitySelectorPath}.toISOString() : ${entitySelectorPath}`;

            // if it is nullable or optional, assign in an if block, otherwise we 
            // could unintentionally assign null/undefined to a property that does not exist
            if (property.isOptional || property.isNullable) {
                const ifAssignment = `${entityAssignmentPath} = ${entitySelectorPath} instanceof Date ? ${entitySelectorPath}.toISOString() : ${entitySelectorPath}`;
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