import { useEffect, useState } from "react";
import { useQuery } from "@routier/react";
import { ProductGrid, store, type Product } from "./ProductGrid";

/**
 * Homepage demo chrome around ProductGrid: sample data, an Add button, and a
 * traffic toggle that writes in the background. ProductGrid never hears about
 * those writes directly, only through its live queries.
 */
export function ShowcaseGrid({ onReady }: { onReady?: () => void }) {
  const [traffic, setTraffic] = useState(false);
  const loaded = useQuery<number>(onResult => store.products.subscribe().count(onResult), []);
  const ready = loaded.status === "success" && loaded.data > 0;

  useEffect(() => {
    void seedOnce();
  }, []);

  useEffect(() => {
    if (ready) onReady?.();
  }, [ready]);

  useEffect(() => {
    if (!traffic) return;
    const timer = setInterval(() => void simulateTraffic(), 900);
    return () => clearInterval(timer);
  }, [traffic]);

  return (
    <>
      <div className="grid-bar">
        <span className="grid-title">Inventory</span>
        <span className={ready ? "live is-ready" : "live"}>
          <span className="dot" />
          live
        </span>
        <span className="spacer" />
        <button type="button" className="chip" disabled={!ready} onClick={() => void addRandomProduct()}>
          + Add
        </button>
        <button
          type="button"
          className={traffic ? "chip is-on" : "chip"}
          aria-pressed={traffic}
          disabled={!ready}
          onClick={() => setTraffic(on => !on)}
        >
          {traffic ? "■ Stop traffic" : "▶ Traffic"}
        </button>
      </div>
      <div className="grid-body">
        <ProductGrid />
      </div>
    </>
  );
}

// Created once per page load and shared if the homepage remounts.
let seeding: Promise<void> | null = null;
function seedOnce() {
  seeding ??= (async () => {
    await store.products.addAsync(...Array.from({ length: 42 }, (_, n) => makeProduct(n)));
    await store.saveChangesAsync();
  })();
  return seeding;
}

async function addRandomProduct() {
  await store.products.addAsync(makeProduct(Math.floor(Math.random() * 10_000)));
  await store.saveChangesAsync();
}

async function simulateTraffic() {
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

const CATEGORIES = ["Audio", "Cameras", "Computers", "Gaming", "Phones", "Wearables"];
const NAMES = ["Aurora", "Beacon", "Cascade", "Drift", "Echo", "Flux", "Glide", "Halo", "Ion", "Jolt", "Krypton", "Lumen", "Nova", "Orbit", "Pulse", "Quartz", "Ripple", "Summit", "Tidal", "Vertex", "Zenith"];
const MODELS = ["Air", "Pro", "Max", "Mini", "Neo", "Ultra"];

function makeProduct(n: number): Omit<Product, "id"> {
  return {
    name: `${NAMES[n % NAMES.length]} ${MODELS[(n * 5) % MODELS.length]}`,
    category: CATEGORIES[(n * 7) % CATEGORIES.length],
    price: 19.99 + ((n * 37) % 480),
    stock: (n * 13) % 40,
  };
}
