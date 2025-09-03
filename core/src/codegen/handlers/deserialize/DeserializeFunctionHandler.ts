import { CodeBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class DeserializeFunctionHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.functionBody != null && property.type === SchemaTypes.Function) {
            // Functions are always unmapped
            return builder;
        }

        return super.handle(property, builder);
    }
}