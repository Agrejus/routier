import { CodeBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo } from "../../../schema";

export class StripIdentityHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.isIdentity === true) {
            return builder;
        }

        return super.handle(property, builder);
    }
}