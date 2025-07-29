import { CodeBuilder } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo } from "@core/schema";

export class EnrichmentPrimitiveHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        this.setEnrichedProperty(property, builder);

        return builder;
    }
}