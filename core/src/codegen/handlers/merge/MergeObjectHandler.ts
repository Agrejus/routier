import { CodeBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

/**
 * Object containers are not merged directly — their child properties merge
 * individually and materialize the destination ancestors they need.
 */
export class MergeObjectHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Object) {
            return builder;
        }

        return super.handle(property, builder);
    }
}
