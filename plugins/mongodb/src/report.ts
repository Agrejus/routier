import { parameter, parameteriseDocument, type ExecutedQuery, type ParameterHolder } from "@routier/core/plugins";
import type { MongoFindOptions } from "./driver";
import type { MqlFilter } from "./mql";

type MqlValue = MqlFilter[string];
type Reported = ParameterHolder | Reported[] | { [key: string]: Reported };

const isPlainObject = (value: MqlValue): value is MqlFilter =>
    typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;

const asParameters = (value: MqlValue): Reported => {
    if (Array.isArray(value)) {
        return value.map(asParameters);
    }

    if (isPlainObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, asParameters(nested)]));
    }

    return parameter(value);
};

/** The `find` a query ran, with every value in the filter written as `?` and listed in `parameters`. */
export const findReport = (collectionName: string, filter: MqlFilter, find: MongoFindOptions): ExecutedQuery => {
    const document = parameteriseDocument(asParameters(filter));
    const options = Object.keys(find).length > 0 ? `, ${JSON.stringify(find)}` : "";

    return {
        text: `db.${collectionName}.find(${document.text}${options})`,
        ...(document.parameters.length > 0 ? { parameters: document.parameters } : {}),
        language: "mongodb",
    };
};
