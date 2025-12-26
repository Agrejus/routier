import { CodeBuilder, ContainerBlock, IfBuilder, SlotBlock } from '../../blocks';
import { SlotPath } from '../../SlotPath';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

/**
 * Handles converting a Date value from JavaScript to a string value.  Should handle remapping here because it is the lowest level in the code here.
 * Remapping higher up could break lower level code
 */
export class SerializeDateHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Date) {
            let objectBuilder = builder.get<SlotBlock>("if");
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity", useFromPropertyName: property.isRenamed });
            const entityAssignmentPath = property.getAssignmentPath({
                parent: "result"
            });
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
                objectBuilder.if(`Object.hasOwn(entity, "${property.name}")`).appendBody(`${entityAssignmentPath} = ${entitySelectorPath} instanceof Date ? ${entitySelectorPath}.toISOString() : ${entitySelectorPath}`)

                return builder;
            }

            const parentSelectPath = ["entity", ...property.getParentPathArray()].join(".");
            const parentAssignPath = ["result", ...property.getParentPathArray()].join(".");

            const ifSlot = objectBuilder.if(`Object.hasOwn(${parentSelectPath}, "${property.name}")`);

            if (property.parent.isNullable || property.parent.isOptional) {
                const conditionallyCreateParent = new IfBuilder(`${parentAssignPath} == null`).appendBody(`${parentAssignPath} = {}`);
                ifSlot.appendBody(conditionallyCreateParent.toString());
            }

            ifSlot.appendBody(`${entityAssignmentPath} = ${entitySelectorPath} instanceof Date ? ${entitySelectorPath}.toISOString() : ${entitySelectorPath}`);

            return builder;
        }

        return super.handle(property, builder);
    }
}