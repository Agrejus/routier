import { CodeBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo } from "../../../schema";

export class EnrichmentDefaultValueHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.defaultValue != null && typeof property.defaultValue !== "function") {

            this.setEnrichedProperty(property, builder);

            return builder;
        }

        return super.handle(property, builder);
    }
}