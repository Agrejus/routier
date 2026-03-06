import { describe, expect, it, jest } from "@jest/globals";
import { PluginEventResult, Result } from "./Result";

const toPromise = <T>(result: any): Promise<T> =>
    new Promise((resolve, reject) => {
        Result.resolve(result, resolve, reject);
    });

describe("Result", () => {
    it("success(data) returns success payload", () => {
        const r = Result.success({ id: 1 });
        expect(r.ok).toBe("success");
        if (r.ok === "success") {
            expect(r.data).toEqual({ id: 1 });
        }
    });

    it("success() returns success with undefined data", () => {
        const r = Result.success();
        expect(r.ok).toBe("success");
        if (r.ok === "success") {
            expect(r.data).toBeUndefined();
        }
    });

    it("error() returns error payload", () => {
        const error = new Error("boom");
        const r = Result.error(error);
        expect(r.ok).toBe("error");
        if (r.ok === "error") {
            expect(r.error).toBe(error);
        }
    });

    it("partial() returns partial payload", () => {
        const error = new Error("partial");
        const r = Result.partial({ count: 2 }, error);
        expect(r.ok).toBe("partial");
        if (r.ok === "partial") {
            expect(r.data).toEqual({ count: 2 });
            expect(r.error).toBe(error);
        }
    });

    it("resolve() resolves success results", () => {
        const onResolve = jest.fn();
        const onReject = jest.fn();
        Result.resolve(Result.success("ok"), onResolve, onReject);
        expect(onResolve).toHaveBeenCalledWith("ok");
        expect(onReject).not.toHaveBeenCalled();
    });

    it("resolve() rejects error results", () => {
        const onResolve = jest.fn();
        const onReject = jest.fn();
        const error = new Error("nope");
        Result.resolve(Result.error(error), onResolve, onReject);
        expect(onResolve).not.toHaveBeenCalled();
        expect(onReject).toHaveBeenCalledWith(error);
    });

    it("resolve() rejects partial with shaped payload", () => {
        const onResolve = jest.fn();
        const onReject = jest.fn();
        const error = new Error("partial");
        Result.resolve(Result.partial({ progress: 50 }, error), onResolve, onReject);
        expect(onResolve).not.toHaveBeenCalled();
        expect(onReject).toHaveBeenCalledWith({
            partial: { progress: 50 },
            error,
        });
    });

    it("assertSuccess throws when result is not success", () => {
        expect(() => Result.assertSuccess(Result.error("x"))).toThrow("Expected success result");
    });

    it("toPromise-style wrapper resolves success result", async () => {
        await expect(toPromise(Result.success({ id: 10 }))).resolves.toEqual({ id: 10 });
    });

    it("toPromise-style wrapper rejects error result with same error", async () => {
        const error = new Error("db failure");
        await expect(toPromise(Result.error(error))).rejects.toBe(error);
    });

    it("toPromise-style wrapper rejects partial with rejection shape", async () => {
        const error = new Error("partial failure");
        await expect(toPromise(Result.partial({ count: 2 }, error))).rejects.toEqual({
            partial: { count: 2 },
            error,
        });
    });

    it("supports chained resolve across mixed outcomes", async () => {
        const steps: string[] = [];

        await toPromise<string>(Result.success("start"))
            .then((value) => {
                steps.push(value);
                return toPromise<string>(Result.success("next"));
            })
            .then((value) => {
                steps.push(value);
                return toPromise<string>(Result.partial("partial-data", new Error("stop")));
            })
            .catch((e) => {
                steps.push(e.partial);
                steps.push(e.error.message);
            });

        expect(steps).toEqual(["start", "next", "partial-data", "stop"]);
    });
});

describe("PluginEventResult", () => {
    it("success(id, data) includes id and data", () => {
        const r = PluginEventResult.success("evt-1", { id: 1 });
        expect(r.id).toBe("evt-1");
        expect(r.ok).toBe("success");
        if (r.ok === "success") {
            expect(r.data).toEqual({ id: 1 });
        }
    });

    it("success(id) includes id and undefined data", () => {
        const r = PluginEventResult.success("evt-2");
        expect(r.id).toBe("evt-2");
        expect(r.ok).toBe("success");
        if (r.ok === "success") {
            expect(r.data).toBeUndefined();
        }
    });

    it("error(id, error) includes id and error", () => {
        const error = new Error("failed");
        const r = PluginEventResult.error("evt-3", error);
        expect(r.id).toBe("evt-3");
        expect(r.ok).toBe("error");
        if (r.ok === "error") {
            expect(r.error).toBe(error);
        }
    });

    it("partial(id, data, error) includes full payload", () => {
        const error = new Error("partial");
        const r = PluginEventResult.partial("evt-4", { progress: 80 }, error);
        expect(r.id).toBe("evt-4");
        expect(r.ok).toBe("partial");
        if (r.ok === "partial") {
            expect(r.data).toEqual({ progress: 80 });
            expect(r.error).toBe(error);
        }
    });

    it("assertSuccess throws for non-success plugin event result", () => {
        expect(() => PluginEventResult.assertSuccess(PluginEventResult.error("evt-5", "nope"))).toThrow("Expected success result");
    });
});
