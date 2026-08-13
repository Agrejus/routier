import { ITranslatedValue } from "@routier/core/plugins";

query<TRoot extends {}, TShape>(
    event: DbPluginQueryEvent<TRoot, TShape>,
    done: PluginEventCallbackResult<ITranslatedValue<TShape>>
): void {
    const translator = new MyCustomTranslator(event.operation);

    // Execute query against your backend
    this.executeQuery(event.operation, (result) => {
        if (result.ok === "error") {
            done(PluginEventResult.error(event.id, result.error));
            return;
        }

        // Translate raw results to expected shape
        // translate() automatically wraps results in ITranslatedValue to allow
        // iteration (for grouped queries) and change tracking
        const translatedValue = translator.translate(result.data);
        done(PluginEventResult.success(event.id, translatedValue));
    });
}