import { CodeBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

/**
 * Unmapped computed properties are excluded from comparison — they derive from
 * other properties, which are compared directly.
 */
export class CompareComputedHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Computed && property.isUnmapped === true) {
            return builder;
        }

        return super.handle(property, builder);
    }
}
