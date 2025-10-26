import { uuid } from "../../utilities";

export class CallTraceManager {
    private activeOperationId: string | null = null;
    private activeCallStack: string[] = [];

    startNewOperation(): string {
        const operationId = uuid();
        this.activeOperationId = operationId;
        this.activeCallStack = [];
        return operationId;
    }

    isNewOperation(): boolean {
        return this.activeOperationId === null;
    }

    getActiveOperationId(): string {
        if (!this.activeOperationId) {
            throw new Error('No active operation context');
        }
        return this.activeOperationId;
    }

    addMethodToTrace(methodPath: string): string[] {
        if (this.isNewOperation()) {
            this.activeCallStack = [methodPath];
        } else {
            this.activeCallStack.push(methodPath);
        }
        return [...this.activeCallStack];
    }

    removeMethodFromTrace(): void {
        if (!this.isNewOperation()) {
            this.activeCallStack.pop();
        }
    }

    endOperation(): void {
        this.activeOperationId = null;
        this.activeCallStack = [];
    }

    formatMethodPaths(methodPaths: string[]): string[] {
        return methodPaths.map(path => path.replace(/ → /g, '.'));
    }

    getCurrentTrace(): string[] {
        return [...this.activeCallStack];
    }
}