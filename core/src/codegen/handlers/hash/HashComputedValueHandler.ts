import { CodeBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class HashComputedValueHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.functionBody != null && property.type === SchemaTypes.Computed && property.isUnmapped === true) {
            return builder;
        }

        return super.handle(property, builder);
    }
}