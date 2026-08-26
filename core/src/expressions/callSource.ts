import { Call } from "./types";

/**
 * How a {@link Call} is spelled in JavaScript, and where its operand goes.
 *
 * `length` is a property, `Math.abs` is a function, `+` is an operator and `typeof` is a prefix — so
 * a name alone is not enough to render one.
 */
export type CallSource =
    | { form: "method", name: string }
    | { form: "property", name: string }
    | { form: "function", name: string }
    | { form: "operator", symbol: string }
    | { form: "prefix", keyword: string };

export const CALL_SOURCE: Record<Call, CallSource> = {
    "to-lower-case": { form: "method", name: "toLowerCase" },
    "to-upper-case": { form: "method", name: "toUpperCase" },
    "length": { form: "property", name: "length" },
    "trim": { form: "method", name: "trim" },
    "trim-start": { form: "method", name: "trimStart" },
    "trim-end": { form: "method", name: "trimEnd" },
    "index-of": { form: "method", name: "indexOf" },
    "substring": { form: "method", name: "substring" },
    "concat": { form: "method", name: "concat" },
    "replace": { form: "method", name: "replace" },
    "replace-all": { form: "method", name: "replaceAll" },

    "absolute": { form: "function", name: "Math.abs" },
    "floor": { form: "function", name: "Math.floor" },
    "ceiling": { form: "function", name: "Math.ceil" },
    "round": { form: "function", name: "Math.round" },
    "sign": { form: "function", name: "Math.sign" },
    "square-root": { form: "function", name: "Math.sqrt" },
    "power": { form: "function", name: "Math.pow" },

    "add": { form: "operator", symbol: "+" },
    "subtract": { form: "operator", symbol: "-" },
    "multiply": { form: "operator", symbol: "*" },
    "divide": { form: "operator", symbol: "/" },
    "modulo": { form: "operator", symbol: "%" },

    "utc-year": { form: "method", name: "getUTCFullYear" },
    "utc-month": { form: "method", name: "getUTCMonth" },
    "utc-day-of-month": { form: "method", name: "getUTCDate" },
    "utc-day-of-week": { form: "method", name: "getUTCDay" },
    "utc-hour": { form: "method", name: "getUTCHours" },
    "utc-minute": { form: "method", name: "getUTCMinutes" },
    "utc-second": { form: "method", name: "getUTCSeconds" },
    "utc-millisecond": { form: "method", name: "getUTCMilliseconds" },
    "epoch-ms": { form: "method", name: "getTime" },

    "to-string": { form: "function", name: "String" },
    "to-number": { form: "function", name: "Number" },
    "to-boolean": { form: "function", name: "Boolean" },
    "type-of": { form: "prefix", keyword: "typeof" },

    "some": { form: "method", name: "some" },
    "every": { form: "method", name: "every" },
};

/**
 * A call rendered as the JavaScript that produced it, from operand and argument text already
 * rendered by the caller.
 *
 * Takes strings so one implementation serves a live tree and a serialized one.
 */
export const renderCallAsJs = (call: Call, operand: string, args: string[]): string => {
    const source = CALL_SOURCE[call];

    if (source == null) {
        return `${operand}.${call}(${args.join(", ")})`;
    }

    if (source.form === "property") {
        return `${operand}.${source.name}`;
    }

    if (source.form === "method") {
        return `${operand}.${source.name}(${args.join(", ")})`;
    }

    if (source.form === "function") {
        return `${source.name}(${[operand, ...args].join(", ")})`;
    }

    if (source.form === "prefix") {
        return `${source.keyword} ${operand}`;
    }

    return `${[operand, ...args].join(` ${source.symbol} `)}`;
};
