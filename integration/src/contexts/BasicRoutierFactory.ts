import { Routier } from "routier";
import { BasicRoutier } from "./BasicRoutier";

export class BasicContextFactory {

    private contexts: Routier[] = [];

    create() {
        const context = BasicRoutier.create();

        this.contexts.push(context);

        return context;
    }

    async cleanup() {
        await Promise.all(this.contexts.map(async x => x.destroyAsync()))
    }

}