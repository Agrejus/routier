import { CodeBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

/**
 * Functions are excluded from comparison — enrichment assigns a fresh closure
 * per entity, so a reference comparison would report every pair as different.
 */
export class CompareFunctionHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Function) {
            return builder;
        }

        return super.handle(property, builder);
    }
}
