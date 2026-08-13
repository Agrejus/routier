import { CodeBuilder, ContainerBlock, IfBuilder, ObjectBuilder, SlotBlock } from '..';
import { PropertyInfo } from '../../schema/PropertyInfo';
import { SlotPath } from '../SlotPath';
import { SchemaError } from '../../errors/SchemaError';
import { uuid } from '../../utilities/uuid';
import { countWordOccurance } from '../utils';

export interface IHandler {
    setNext(handler: IHandler): IHandler;

    handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null;
}

/**
 * Terminal link for chains that apply only to a subset of properties (keys,
 * identities).  Returning the builder marks every other property as
 * deliberately skipped, so a null return from any chain always means a real
 * coverage gap.
 */
export class NotApplicableHandler implements IHandler {

    setNext(handler: IHandler): IHandler {
        return handler;
    }

    handle(_: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {
        return builder;
    }
}

export abstract class PropertyInfoHandler implements IHandler {

    private _next: IHandler | null;

    setNext(handler: IHandler): IHandler {
        this._next = handler;

        return handler;
    }

    handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null {
        try {
            if (this._next) {
                return this._next.handle(property, builder);
            }

            return null;
        } catch (e: any) {
            throw new SchemaError(e, `Error handling property: ${property.name}`);
        }
    }

    protected buildSlotPath(property: PropertyInfo<any>, path: SlotPath) {

        const result = new SlotPath(...path.path);
        const items: string[] = []
        let p = property;

        while (p.parent != null) {
            items.unshift(p.name);
            p = p.parent;
        }

        items.unshift(p.name);

        result.push(...items);

        return result
    }

    /**
     * Dotted property path from the root entity (e.g. `nested.inner`), used as the
     * change-tracking path prefix so nested writes record against the root's
     * `__tracking__` under their full path.
     */
    protected getTrackingPath(property: PropertyInfo<any>): string {
        const names: string[] = [];
        let p: PropertyInfo<any> | null = property;

        while (p != null) {
            names.unshift(p.name);
            p = p.parent;
        }

        return names.join(".");
    }

    /**
     * Emits `if (<root>.a == null) <root>.a = {};` for every ancestor of a
     * nested property, so assignments through the target object never throw when a
     * parent object is absent. The guards run root-down, so grandparents are
     * materialized before their children.
     */
    protected emitDestinationAncestorGuards(property: PropertyInfo<any>, block: IfBuilder, options?: { root?: string, useFromPropertyName?: boolean }) {
        if (property.parent == null) {
            return;
        }

        const root = options?.root ?? "destination";
        const parentPathArray = property.getParentPathArray({ useFromPropertyName: options?.useFromPropertyName });

        for (let i = 0; i < parentPathArray.length; i++) {
            const pathSoFar = [root, ...parentPathArray.slice(0, i + 1)].join(".");
            block.appendBody(`if (${pathSoFar} == null) ${pathSoFar} = {};`);
        }
    }

    /**
     * Emits the guarded nested-property assignment shared by the serialize handlers:
     * reads the parent through an optional-chained selector (the entity may be a
     * partial — a delta payload or a create payload with absent nested parents),
     * materializes every `result` ancestor, then assigns `valueExpression` to the
     * property's storage-side path.
     */
    protected emitSerializeNestedAssignment(property: PropertyInfo<any>, slot: SlotBlock, valueExpression: string) {
        const parentSelectPath = property.parent!.getSelectrorPath({ parent: "entity", assignmentType: "FORCE_NULLABLE_OR_OPTIONAL" });
        const resultSelectorPath = property.getAssignmentPath({ parent: "result", useFromPropertyName: true });

        const ifSlot = slot.if(`${parentSelectPath} != null && Object.hasOwn(${parentSelectPath}, "${property.name}")`);

        this.emitDestinationAncestorGuards(property, ifSlot, { root: "result", useFromPropertyName: true });

        ifSlot.appendBody(`${resultSelectorPath} = ${valueExpression}`);
    }

    /**
     * Emits the source → destination copy for one property in the merge generator,
     * materializing destination ancestors first.
     *
     * With `onlyWhenChanged`, the assignment is skipped when both sides already hold
     * the same value (compared via `valueOf`, so equal Dates match). This preserves
     * reference identity on the destination when a merge carries no new information —
     * callers hold on to entity instances (e.g. a Date returned from add) and must not
     * see them silently replaced by an equal copy.
     */
    protected emitMergeCopy(property: PropertyInfo<any>, builder: CodeBuilder, options?: { onlyWhenChanged?: boolean }) {
        const selectorPath = property.getSelectrorPath({ parent: "source", assignmentType: "FORCE_NULLABLE_OR_OPTIONAL" });
        const slot = builder.get<SlotBlock>("factory.function.assignments");
        const sourcePath = property.getAssignmentPath({ parent: "source" });
        const destinationPath = property.getAssignmentPath({ parent: "destination" });

        const ifBlock = slot.if(`${selectorPath} != null`);
        this.emitDestinationAncestorGuards(property, ifBlock);

        if (options?.onlyWhenChanged === true) {
            ifBlock.appendBody(`if (${destinationPath} == null || ${destinationPath}.valueOf() !== ${sourcePath}.valueOf()) { ${destinationPath} = ${sourcePath} }`);
            return;
        }

        ifBlock.appendBody(`${destinationPath} = ${sourcePath}`);
    }

    /**
     * Slot path of the ObjectBuilder that renders `property` inside the enriched
     * literal. Builders are registered as `[enriched.<path>]` under their parent
     * builder, so the lookup path must include every ancestor segment — a flat
     * root-level lookup only works for depth-1 properties.
     */
    protected buildEnrichedObjectSlotPath(property: PropertyInfo<any>, base: SlotPath): SlotPath {
        const result = new SlotPath(...base.path);
        const chain: PropertyInfo<any>[] = [];
        let p: PropertyInfo<any> | null = property;

        while (p != null) {
            chain.unshift(p);
            p = p.parent;
        }

        for (const item of chain) {
            result.push(`[${item.getAssignmentPath({ parent: "enriched" })}]`);
        }

        return result;
    }

    protected setEnrichedProperty(property: PropertyInfo<any>, root: CodeBuilder) {
        const entitySelectorPath = property.getAssignmentPath({ parent: "entity" });

        if (property.parent != null) {
            const slotPath = new SlotPath("factory", "function", "enriched", "object", "enriched");
            const parentSlotPath = this.buildEnrichedObjectSlotPath(property.parent, slotPath);
            const objectBuilder = root.get<ObjectBuilder>(parentSlotPath.get());
            // Guarded read: the entity may be sparse (e.g. enrich on a create payload),
            // so the parent object cannot be assumed to exist
            const childEntityPathSelector = property.getSelectrorPath({ parent: "entity", assignmentType: "FORCE_NULLABLE_OR_OPTIONAL" });
            objectBuilder.property(`${property.name}: ${childEntityPathSelector}`);
            return;
        }

        const slotPath = new SlotPath("factory", "function", "enriched", "object", "enriched");
        let enriched = root.getOrDefault<ObjectBuilder>(slotPath.get());

        if (enriched == null) {
            const enrichedSlot = root.get<SlotBlock>("factory.function.enriched");
            enriched = enrichedSlot.variable("enriched", { name: "object" }).object({ name: "enriched" });
        }

        enriched.property(`${property.name}: ${entitySelectorPath}`);
    }

    protected toNamedFunction(stringifiedFunction: string, parent: ContainerBlock) {
        const name = `_${uuid()}`;

        const builder = parent.function(name);
        const occurences = countWordOccurance(stringifiedFunction, "=>")

        if (occurences > 0) {

            const split = stringifiedFunction.split("=>").map(w => w.trim());
            const parameters = split[0].replace(/\(|\)/g, "").split(",");
            let body = split[1];

            if (occurences > 1) {
                // we have a function that returns a function
                const index = stringifiedFunction.indexOf("=>");
                body = stringifiedFunction.slice(index + 2, stringifiedFunction.length)
            }

            if (body.startsWith("{") === true && body.endsWith("}")) {

                // Remove brackets, wrapping function will have them
                builder.appendBody(body.slice(1, body.length - 1));

                return {
                    builder,
                    parameters
                };
            }

            builder.appendBody(`return ${body};`);
            return {
                builder,
                parameters
            }
        }

        throw new Error("Only arrow functions are allowed in the schema definition:  function () {}  --->  () => {}");
    }
}