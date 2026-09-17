import { useEffect, useState } from "react";
import { useQuery } from "@routier/react";
import { ProductGrid } from "./ProductGrid";
import { store } from "./inventory";
import { addRandomProduct, seedOnce, simulateTraffic } from "./inventorySimulation";

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
