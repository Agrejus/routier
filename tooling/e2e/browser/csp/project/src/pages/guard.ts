const violations: string[] = [];

document.addEventListener("securitypolicyviolation", event => {
    violations.push(event.effectiveDirective);
});
window.addEventListener("error", event => {
    Reflect.set(window, "__error", String(event.message));
});
Reflect.set(window, "__violations", violations);
