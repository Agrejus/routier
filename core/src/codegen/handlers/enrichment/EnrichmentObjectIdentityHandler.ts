import { CodeBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "@core/schema";

export class EnrichmentObjectIdentityHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.isIdentity === true && property.type == SchemaTypes.Object) {
            // do nothing right now
            return builder;
        }

        return super.handle(property, builder);
    }
}