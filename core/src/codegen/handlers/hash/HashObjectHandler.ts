import { CodeBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

/**
 * Object containers are not hashed directly — their child properties hash
 * individually, which keeps the hash stable across key insertion order.
 */
export class HashObjectHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Object) {
            return builder;
        }

        return super.handle(property, builder);
    }
}
