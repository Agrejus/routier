import { mountRoutierDevtools } from "@routier/devtools";
import { TaskStore } from "./store";

const store = new TaskStore();

mountRoutierDevtools(store, { name: "Tasks" });

let created = 0;

async function addTask() {
    created++;
    await store.tasks.addAsync({
        title: `Task ${created}`,
        done: false,
        createdAt: new Date(),
        tags: created % 2 === 0 ? ["even"] : ["odd"],
    });
    await store.saveChangesAsync();
}

async function completeOldestOpenTask() {
    const task = await store.tasks.firstOrUndefinedAsync(candidate => candidate.done === false);
    if (task === undefined) return;
    task.done = true;
    await store.saveChangesAsync();
}

async function addMany() {
    for (let index = 0; index < 120; index++) await addTask();
}

const actions: Record<string, () => Promise<void>> = {
    add: addTask,
    complete: completeOldestOpenTask,
    many: addMany,
};

document.addEventListener("click", event => {
    const button = event.target instanceof HTMLElement ? event.target.closest("button[data-action]") : null;
    const action = button instanceof HTMLButtonElement ? actions[button.dataset.action ?? ""] : undefined;
    if (action !== undefined) void action();
});
