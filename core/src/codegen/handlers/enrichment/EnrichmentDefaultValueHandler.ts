import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo } from "../../../schema";

export class EnrichmentDefaultValueHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.defaultValue != null && typeof property.defaultValue !== "function") {

            this.setEnrichedProperty(property, builder);

            // Apply the literal default when no value came in, mirroring
            // EnrichmentDefaultFunctionHandler's if-block for function defaults
            const ifsSlot = builder.get<SlotBlock>("factory.function.ifs");
            const checkPath = property.getSelectrorPath({ parent: "enriched", assignmentType: "FORCE_NULLABLE_OR_OPTIONAL" });
            const assignmentPath = property.getAssignmentPath({ parent: "enriched" });
            const ifBlock = ifsSlot.if(`${checkPath} == null`);

            // Nested property: ensure every ancestor object exists before the assignment
            if (property.parent != null) {
                const parentPathArray = property.getParentPathArray();

                for (let i = 0; i < parentPathArray.length; i++) {
                    const pathSoFar = ["enriched", ...parentPathArray.slice(0, i + 1)].join(".");
                    ifBlock.appendBody(`if (${pathSoFar} == null) ${pathSoFar} = {};`);
                }
            }

            ifBlock.appendBody(`${assignmentPath} = ${renderDefaultLiteral(property.defaultValue)}`);

            return builder;
        }

        return super.handle(property, builder);
    }
}

const renderDefaultLiteral = (value: unknown) => {

    if (value instanceof Date) {
        return `new Date(${value.getTime()})`;
    }

    // JSON covers strings (with escaping), numbers, booleans, plain objects and arrays
    return JSON.stringify(value);
}