import { CodeBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

/**
 * Merges an array by copying elements INTO the destination's existing array instead of
 * replacing the reference.
 *
 * The reference matters: a change-tracked entity holds its array wrapped in a tracking
 * proxy, and merge runs paused — a plain `destination.values = source.values` discards
 * that proxy silently, so every in-place mutation made after the entity's first save
 * (afterPersist merges the plugin's echo into the canonical) was no longer tracked and
 * vanished on the next save (defect #12). Copying in place keeps the caller's array
 * reference stable and the proxy installed, and shares no reference with the source.
 *
 * When the destination has no array yet there is nothing to preserve, so the source
 * reference is adopted as-is — same as the primitive copy this replaces.
 */
export class MergeArrayHandler extends PropertyInfoHandler {

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Array) {
            const selectorPath = property.getSelectrorPath({ parent: "source", assignmentType: "FORCE_NULLABLE_OR_OPTIONAL" });
            const slot = builder.get<SlotBlock>("factory.function.assignments");
            const sourcePath = property.getAssignmentPath({ parent: "source" });
            const destinationPath = property.getAssignmentPath({ parent: "destination" });

            const ifBlock = slot.if(`${selectorPath} != null`);
            this.emitDestinationAncestorGuards(property, ifBlock);

            ifBlock.appendBody(`if (${destinationPath} == null) { ${destinationPath} = ${sourcePath} } else if (${destinationPath} !== ${sourcePath}) { ${destinationPath}.length = 0; for (let i = 0; i < ${sourcePath}.length; i++) { ${destinationPath}[i] = ${sourcePath}[i]; } }`);

            return builder;
        }

        return super.handle(property, builder);
    }
}
