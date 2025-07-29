import { CodeBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo } from "@core/schema";

export class HashIdentityHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.isIdentity === true) {
            return builder;
        }

        return super.handle(property, builder);
    }
}