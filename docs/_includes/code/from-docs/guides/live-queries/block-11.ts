// Clean up live queries when components unmount
class UserComponent {
  private unsubscribe: (() => void) | null = null;

  initialize() {
    const subscription = ctx.users.subscribe().toArray((result) => {
      if (result.ok === "success") {
        // Handle data
      }
    });
    this.unsubscribe = subscription.unsubscribe;
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}