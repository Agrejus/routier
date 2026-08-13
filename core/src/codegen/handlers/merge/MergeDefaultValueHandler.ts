import { CodeBuilder, FunctionFactoryBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo } from "../../../schema";

export class MergeDefaultValueHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.defaultValue != null && typeof property.defaultValue !== "function") {
            const defaultFunctionParameters: string[] = [];

            if (property.injected != null) {
                const factory = builder.get<FunctionFactoryBuilder>("factory");
                const parameter = factory.createParameter(property.injected);
                factory.parameters(parameter);

                defaultFunctionParameters.push(parameter.name);
            }

            // A defaulted property still merges from the source; the default only fills
            // the gap when neither side has a value
            this.emitMergeCopy(property, builder, { onlyWhenChanged: true });

            const ifsSlot = builder.get<SlotBlock>("factory.function.ifs");
            // we only want to run if the destination is null; the guarded selector keeps
            // the check from throwing when a destination ancestor is absent
            const selectorPath = property.getSelectrorPath({ parent: "destination", assignmentType: "FORCE_NULLABLE_OR_OPTIONAL" });
            const assignmentPath = property.getAssignmentPath({ parent: "destination" });

            const defaultIf = ifsSlot.if(`${selectorPath} == null`);
            this.emitDestinationAncestorGuards(property, defaultIf);
            defaultIf.appendBody(`${assignmentPath} = ${typeof property.defaultValue === "string" ? `"${property.defaultValue}"` : property.defaultValue}`);

            return builder;
        }

        return super.handle(property, builder);
    }
}