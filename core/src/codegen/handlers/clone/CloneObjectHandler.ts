import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

export class CloneObjectHandler extends PropertyInfoHandler {

    constructor(private readonly useFromPropertyName: boolean) {
        super();
    }

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Object) {
            const useFromPropertyName = this.useFromPropertyName;
            const entitySelectorPath = property.getSelectrorPath({ parent: "entity", useFromPropertyName });
            const resultAssignmentPath = property.getAssignmentPath({ parent: "result", useFromPropertyName });
            builder.get<SlotBlock>("if")
                .if(`${entitySelectorPath} !== undefined`)
                .appendBody(`${resultAssignmentPath} = ${entitySelectorPath} === null ? null : {}`);
            return builder;
        }

        return super.handle(property, builder);
    }
}
