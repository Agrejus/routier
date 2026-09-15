import { CodeBuilder, IfBuilder, ObjectBuilder, SlotBlock } from '..';
import { PropertyInfo } from '../../schema/PropertyInfo';
import { SlotPath } from '../SlotPath';
import { SchemaError } from '../../errors/SchemaError';

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

    /**
     * Binds a function the schema author supplied (a default, a computed, a serializer) into
     * the generated code and returns the expression that calls it with `args`.
     *
     * The function is passed in by value rather than pasted in as source text. Pasted source
     * loses the scope it was written in, so a default that called an imported helper threw, and
     * it had to be parsed back apart, which only worked for arrows: a bundler that lowers arrows
     * to `function` expressions, or renames what they refer to, broke every schema (#46).
     */
    protected emitBoundCall(target: { bind(value: unknown): string }, fn: Function, args: string[]) {
        return `${target.bind(fn)}(${args.join(", ")})`;
    }
}