import { CodeBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "@core/schema";

export class EnableChangeTrackingPrimitiveValueHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type !== SchemaTypes.Object) {
            return builder;
        }

        return super.handle(property, builder);
    }
}