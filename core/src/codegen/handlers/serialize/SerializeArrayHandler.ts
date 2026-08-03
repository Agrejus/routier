import { CodeBuilder, IfBuilder, SlotBlock } from '../../blocks';
import { PropertyInfoHandler } from "../types";
import { PropertyInfo, SchemaTypes } from "../../../schema";

/**
 * Serializes arrays per element instead of copying the reference:
 *
 * - Date elements become ISO strings (same convention as SerializeDateHandler).
 * - Object elements are deep-copied so the storage payload shares no references
 *   with the entity.
 * - Primitive elements are copied with a spread.
 *
 * Producing a NEW array also matters for change tracking: tracked entities hold
 * arrays wrapped in a Proxy, which cannot pass a structured-clone boundary
 * (BroadcastChannel.postMessage) — the serialized payload must be plain data.
 */
export class SerializeArrayHandler extends PropertyInfoHandler {

    private copyExpression(property: PropertyInfo<any>, selector: string): string {
        const elementType = property.innerSchema?.type;

        if (elementType === SchemaTypes.Date) {
            return `${selector}.map(function (v) { return v instanceof Date ? v.toISOString() : v; })`;
        }

        if (elementType === SchemaTypes.Object || elementType === SchemaTypes.Array || elementType === SchemaTypes.Definition) {
            return `${selector}.map(function (v) { return v == null ? v : structuredClone(v); })`;
        }

        return `[...${selector}]`;
    }

    override handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {

        if (property.type === SchemaTypes.Array) {
            const slot = builder.get<SlotBlock>("if");
            // Serialize maps in-memory shape -> storage shape: read the entity by
            // property name, write the result by `from` (storage) name
            const entitySelectorPath = property.getAssignmentPath({ parent: "entity" });
            const resultSelectorPath = property.getAssignmentPath({ parent: "result", useFromPropertyName: true });

            // Null propagates as-is (nullable arrays); only real arrays are copied
            const valueExpression = `${entitySelectorPath} == null ? ${entitySelectorPath} : ${this.copyExpression(property, entitySelectorPath)}`;

            if (property.parent == null) {
                // Only assign if the incoming entity has the property, this allows partial
                // serialization (delta payloads carry only changed keys)
                slot.if(`Object.hasOwn(entity, "${property.name}")`).appendBody(`${resultSelectorPath} = ${valueExpression}`);
                return builder;
            }

            const parentSelectPath = ["entity", ...property.getParentPathArray()].join(".");
            const parentAssignPath = ["result", ...property.getParentPathArray({ useFromPropertyName: true })].join(".");

            const ifSlot = slot.if(`${parentSelectPath} != null && Object.hasOwn(${parentSelectPath}, "${property.name}")`);

            if (property.parent.isNullable || property.parent.isOptional) {
                const conditionallyCreateParent = new IfBuilder(`${parentAssignPath} == null`).appendBody(`${parentAssignPath} = {}`);
                ifSlot.appendBody(conditionallyCreateParent.toString());
            }

            ifSlot.appendBody(`${resultSelectorPath} = ${valueExpression}`);

            return builder;
        }

        return super.handle(property, builder);
    }
}
