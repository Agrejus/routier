import { store, type Product } from "./inventory";

const CATEGORIES = ["Audio", "Cameras", "Computers", "Gaming", "Phones", "Wearables"];
const NAMES = ["Aurora", "Beacon", "Cascade", "Drift", "Echo", "Flux", "Glide", "Halo", "Ion", "Jolt", "Krypton", "Lumen", "Nova", "Orbit", "Pulse", "Quartz", "Ripple", "Summit", "Tidal", "Vertex", "Zenith"];
const MODELS = ["Air", "Pro", "Max", "Mini", "Neo", "Ultra"];

let seeding: Promise<void> | null = null;

export function seedOnce() {
  seeding ??= (async () => {
    await store.products.addAsync(...Array.from({ length: 42 }, (_, n) => makeProduct(n)));
    await store.saveChangesAsync();
  })();
  return seeding;
}

export async function addRandomProduct() {
  await store.products.addAsync(makeProduct(Math.floor(Math.random() * 10_000)));
  await store.saveChangesAsync();
}

export async function simulateTraffic() {
  if (Math.random() < 0.3) return addRandomProduct();
  const count = await store.products.countAsync();
  const [product] = await store.products
    .sort(p => p.name)
    .skip(Math.floor(Math.random() * Math.min(count, 12)))
    .take(1)
    .toArrayAsync();
  if (!product) return;
  product.stock = Math.floor(Math.random() * 40);
  await store.saveChangesAsync();
}

function makeProduct(n: number): Omit<Product, "id"> {
  return {
    name: `${NAMES[n % NAMES.length]} ${MODELS[(n * 5) % MODELS.length]}`,
    category: CATEGORIES[(n * 7) % CATEGORIES.length],
    price: 19.99 + ((n * 37) % 480),
    stock: (n * 13) % 40,
  };
}
