import { CodeBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

/**
 * Unmapped computed properties never persist — strip removes them along with
 * keys and identities.
 */
export class StripComputedHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Computed && property.isUnmapped === true) {
            return builder;
        }

        return super.handle(property, builder);
    }
}
