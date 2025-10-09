import { AssignmentBuilder, CodeBuilder, ContainerBlock, ObjectBuilder, SlotBlock } from '..';
import { PropertyInfo } from '../../schema/PropertyInfo';
import { SlotPath } from '../SlotPath';
import { SchemaError } from '../../errors/SchemaError';
import { uuid } from '../../utilities/uuid';
import { countWordOccurance } from '../utils';

export interface IHandler {
    setNext(handler: IHandler): IHandler;

    handle(property: PropertyInfo<any>, builder: CodeBuilder): CodeBuilder | null;
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

    protected setEnrichedProperty(property: PropertyInfo<any>, root: CodeBuilder) {
        const useFromPropertyName = property.from != null;
        const entitySelectorPath = property.getAssignmentPath({ parent: "entity", useFromPropertyName });

        if (property.parent != null) {
            const slotPath = new SlotPath("factory", "function", "enriched", "object", "enriched");
            const path = property.parent.getAssignmentPath({ parent: "enriched" });
            slotPath.push(`[${path}]`)
            const objectBuilder = root.get<ObjectBuilder>(slotPath.get());
            const childEntityPathSelector = property.getSelectrorPath({ parent: "entity", useFromPropertyName });
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