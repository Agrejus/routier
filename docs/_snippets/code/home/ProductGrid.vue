<!-- #region focus -->
<script setup lang="ts">
import { computed, ref } from "vue";
import { useQuery } from "@routier/vue";
import { store, type Product } from "./inventory";

const page = ref(1);
const pageSize = ref(6);

const rows = useQuery<Product[]>(onResult =>
  store.products
    .sort(p => p.name)
    .skip((page.value - 1) * pageSize.value)
    .take(pageSize.value)
    .subscribe()
    .toArray(onResult),
);
// #endregion focus

// #region below
const total = useQuery<number>(onResult => store.products.subscribe().count(onResult));
const count = computed(() => (total.value.status === "success" ? total.value.data : 0));
const pageCount = computed(() => Math.max(1, Math.ceil(count.value / pageSize.value)));

async function restock(product: Product) {
  product.stock += 10;
  await store.saveChangesAsync();
}
</script>

<template>
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th>Category</th>
        <th>Price</th>
        <th>Stock</th>
        <th />
      </tr>
    </thead>
    <tbody>
      <tr v-if="rows.status === 'error'">
        <td colspan="5">{{ rows.error.message }}</td>
      </tr>
      <template v-if="rows.status === 'success'">
        <tr v-for="product in rows.data" :key="product.id">
          <td>{{ product.name }}</td>
          <td>{{ product.category }}</td>
          <td>${{ product.price.toFixed(2) }}</td>
          <td>{{ product.stock }}</td>
          <td>
            <button @click="restock(product)">+10</button>
          </td>
        </tr>
      </template>
    </tbody>
  </table>

  <footer>
    <select v-model.number="pageSize" @change="page = 1">
      <option :value="6">6 / page</option>
      <option :value="10">10 / page</option>
      <option :value="20">20 / page</option>
    </select>
    <button :disabled="page === 1" @click="page--">‹</button>
    <span>Page {{ page }} of {{ pageCount }}</span>
    <button :disabled="page >= pageCount" @click="page++">›</button>
  </footer>
</template>
<!-- #endregion below -->
