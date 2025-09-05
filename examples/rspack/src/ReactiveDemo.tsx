import { useDataStore } from './DexieStore';
import { Product } from './schemas/product';
import { useQuery } from "@routier/react";
import { useState } from "react";

export function ReactiveDemo() {
	const dataStore = useDataStore();
	const [lastAction, setLastAction] = useState<string>("");
	const [actionCount, setActionCount] = useState(0);
	const [refreshTrigger, setRefreshTrigger] = useState(0);

	// Reactive query - will automatically update when data changes
	const reactiveProducts = useQuery<Product[]>(
		c => dataStore.products.subscribe().toArray(c),
		[]
	);

	// Non-reactive query - will only run when refreshTrigger changes
	const nonReactiveProducts = useQuery<Product[]>(
		c => dataStore.products.toArray(c),
		[refreshTrigger] // Dependency that triggers re-query
	);

	// Add a new product
	const addProduct = async () => {
		try {
			const newProduct = {
				name: `Product ${Date.now()}`,
				price: Math.floor(Math.random() * 1000) + 10,
				category: "demo",
				description: "Auto-generated product for demo",
				inStock: Math.random() > 0.5,
				more: {
					one: "default",
					two: "default"
				},
				cool: "default",
				two: "default"
			};

			await dataStore.products.addAsync(newProduct);
			await dataStore.saveChangesAsync();
			
			setLastAction(`Added: ${newProduct.name}`);
			setActionCount(prev => prev + 1);
		} catch (error) {
			console.error("Error adding product:", error);
			setLastAction("Error adding product");
		}
	};

	// Update a random product
	const updateRandomProduct = async () => {
		try {
			if (reactiveProducts.status !== 'success' || !reactiveProducts.data || reactiveProducts.data.length === 0) {
				setLastAction("No products to update");
				return;
			}

			const randomIndex = Math.floor(Math.random() * reactiveProducts.data.length);
			const product = reactiveProducts.data[randomIndex];
            
            product.price = Math.floor(Math.random() * 1000) + 10;
            product.description = `Updated at ${new Date().toLocaleTimeString()}`

			await dataStore.saveChangesAsync();
			
			setLastAction(`Updated: ${product.name}`);
			setActionCount(prev => prev + 1);
		} catch (error) {
			console.error("Error updating product:", error);
			setLastAction("Error updating product");
		}
	};

	// Remove a random product
	const removeRandomProduct = async () => {
		try {
			if (reactiveProducts.status !== 'success' || !reactiveProducts.data || reactiveProducts.data.length === 0) {
				setLastAction("No products to remove");
				return;
			}

			const randomIndex = Math.floor(Math.random() * reactiveProducts.data.length);
			const product = reactiveProducts.data[randomIndex];
			
			await dataStore.products.removeAsync(product);
			await dataStore.saveChangesAsync();
			
			setLastAction(`Removed: ${product.name}`);
			setActionCount(prev => prev + 1);
		} catch (error) {
			console.error("Error removing product:", error);
			setLastAction("Error removing product");
		}
	};

	// Refresh non-reactive data manually by triggering a re-query
	const refreshNonReactiveData = () => {
		// Force a re-query by updating the dependency
		setRefreshTrigger(prev => prev + 1);
		setLastAction("Refreshed non-reactive data (re-query triggered)");
		setActionCount(prev => prev + 1);
	};

	// Clear all products
	const clearAllProducts = async () => {
		try {
			if (reactiveProducts.status !== 'success' || !reactiveProducts.data || reactiveProducts.data.length === 0) {
				setLastAction("No products to clear");
				return;
			}

			await dataStore.products.removeAllAsync();
			await dataStore.saveChangesAsync();
			
			setLastAction("Cleared all products");
			setActionCount(prev => prev + 1);
		} catch (error) {
			console.error("Error clearing products:", error);
			setLastAction("Error clearing products");
		}
	};

	return (
		<div className="reactive-demo">
			<div className="demo-header">
				<h2>Reactive vs Non-Reactive Queries</h2>
				<p className="demo-description">
					This demonstrates the difference between using <code>useQuery</code> with subscription-based queries vs. non-subscription queries.
					Both use <code>useQuery</code>, but the reactive one uses <code>.subscribe()</code> while the non-reactive one doesn't.
				</p>
			</div>

			<div className="demo-controls">
				<h3>Data Operations</h3>
				<div className="control-buttons">
					<button onClick={addProduct} className="control-btn add-btn">
						➕ Add Product
					</button>
					<button onClick={updateRandomProduct} className="control-btn update-btn">
						✏️ Update Random
					</button>
					<button onClick={removeRandomProduct} className="control-btn remove-btn">
						🗑️ Remove Random
					</button>
					<button onClick={refreshNonReactiveData} className="control-btn refresh-btn">
						🔄 Refresh Non-Reactive
					</button>
					<button onClick={clearAllProducts} className="control-btn clear-btn">
						🧹 Clear All
					</button>
				</div>

				<div className="action-info">
					<p><strong>Last Action:</strong> {lastAction}</p>
					<p><strong>Total Actions:</strong> {actionCount}</p>
					<p><strong>Non-Reactive Refresh Count:</strong> {refreshTrigger}</p>
				</div>
			</div>

			<div className="comparison-grid">
				<div className="data-section reactive-section">
					<h3>🔄 Reactive Query (with subscribe)</h3>
					<p className="section-description">
						This <code>useQuery</code> uses <code>dataStore.products.subscribe().toArray(c)</code> and automatically updates when data changes.
					</p>
					
					<div className="data-stats">
						<p><strong>Product Count:</strong> {reactiveProducts.status === 'success' ? reactiveProducts.data?.length || 0 : '...'}</p>
						<p><strong>Last Updated:</strong> {reactiveProducts.status === 'success' ? new Date().toLocaleTimeString() : '...'}</p>
						<p><strong>Status:</strong> <span className="status-badge success">Live</span></p>
						<p><strong>Query Status:</strong> <span className="query-status">{reactiveProducts.status}</span></p>
					</div>

					{reactiveProducts.status === 'success' && reactiveProducts.data && (
						<div className="products-preview">
							<h4>Recent Products:</h4>
							<div className="products-list">
								{reactiveProducts.data.slice(-5).reverse().map((product) => (
									<div key={product._id} className="product-item">
										<span className="product-name">{product.name}</span>
										<span className="product-price">${product.price?.toFixed(2) || '0.00'}</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				<div className="data-section non-reactive-section">
					<h3>📊 Non-Reactive Query (no subscribe)</h3>
					<p className="section-description">
						This <code>useQuery</code> uses <code>dataStore.products.toArray(c)</code> (no subscribe) and only updates when the component re-renders or dependencies change.
					</p>
					
					<div className="data-stats">
						<p><strong>Product Count:</strong> {nonReactiveProducts.status === 'success' ? nonReactiveProducts.data?.length || 0 : '...'}</p>
						<p><strong>Last Updated:</strong> {nonReactiveProducts.status === 'success' ? 'Component re-render only' : '...'}</p>
						<p><strong>Status:</strong> <span className="status-badge static">Static</span></p>
						<p><strong>Query Status:</strong> <span className="query-status">{nonReactiveProducts.status}</span></p>
					</div>

					{nonReactiveProducts.status === 'success' && nonReactiveProducts.data && (
						<div className="products-preview">
							<h4>Products (as of last render):</h4>
							<div className="products-list">
								{nonReactiveProducts.data.slice(-5).reverse().map((product) => (
									<div key={product._id} className="product-item">
										<span className="product-name">{product.name}</span>
										<span className="product-price">${product.price?.toFixed(2) || '0.00'}</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</div>

			<div className="explanation-section">
				<h3>How It Works</h3>
				<div className="explanation-grid">
					<div className="explanation-item">
						<h4>🔄 Reactive useQuery (with subscribe)</h4>
						<ul>
							<li>Uses <code>dataStore.products.subscribe().toArray(c)</code></li>
							<li>Automatically updates when database changes</li>
							<li>Perfect for real-time dashboards</li>
							<li>React components re-render automatically</li>
							<li>Uses Routier's change tracking system</li>
						</ul>
					</div>
					
					<div className="explanation-item">
						<h4>📊 Non-Reactive useQuery (no subscribe)</h4>
						<ul>
							<li>Uses <code>dataStore.products.toArray(c)</code></li>
							<li>Only updates on component re-renders</li>
							<li>Good for one-time data loading</li>
							<li>More performant for static data</li>
							<li>Requires manual refresh or dependency changes</li>
						</ul>
					</div>
					
					<div className="explanation-item">
						<h4>🎯 Key Differences</h4>
						<ul>
							<li><strong>Both use useQuery:</strong> Same React pattern, different query strategy</li>
							<li><strong>Reactive:</strong> <code>.subscribe()</code> creates a live connection</li>
							<li><strong>Non-Reactive:</strong> No subscription, just one-time fetch</li>
							<li><strong>Performance:</strong> Choose based on update frequency needs</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
}
