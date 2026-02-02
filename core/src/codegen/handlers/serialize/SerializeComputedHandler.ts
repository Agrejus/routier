import { CodeBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class SerializeComputedHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Computed && property.isUnmapped === true) {
            // Do not serialize computed properties that are unmapped
            return builder;
        }

        return super.handle(property, builder);
    }
}