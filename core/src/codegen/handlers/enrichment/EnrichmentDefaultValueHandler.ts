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
            const assignmentPath = property.getAssignmentPath({ parent: "enriched" });
            ifsSlot.if(this.whenParentPresent(property, `${assignmentPath} == null`))
                .appendBody(`${assignmentPath} = ${renderDefaultLiteral(property.defaultValue)}`);

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