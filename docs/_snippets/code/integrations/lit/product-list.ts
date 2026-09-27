import { LitElement, html } from "lit";
import { LiveQueryController } from "@routier/lit";
import { store, type Product } from "../../home/inventory";

const pageSize = 6;

export class ProductList extends LitElement {
  static override properties = { page: { type: Number } };

  page = 1;

  private rows = new LiveQueryController<Product[], readonly [number]>(this, {
    args: () => [this.page] as const,
    query: ([page]) => (onResult) =>
      store.products
        .sort((p) => p.name)
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .subscribe()
        .toArray(onResult),
  });

  override render() {
    const state = this.rows.state;

    if (state.status === "pending") {
      return html`<p>Loading…</p>`;
    }

    if (state.status === "error") {
      return html`<p>${state.error.message}</p>`;
    }

    return html`
      <ul>${state.data.map((product) => html`<li>${product.name}: ${product.stock}</li>`)}</ul>
      <button ?disabled=${this.page === 1} @click=${() => this.page--}>‹</button>
      <button @click=${() => this.page++}>›</button>
    `;
  }
}

customElements.define("product-list", ProductList);
