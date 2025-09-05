import { useDataStore } from './DexieStore';
import { useQuery } from "@routier/react";
import { useState } from "react";

interface ProductFormData {
	name: string;
	price: number;
	category: string;
	description: string;
	inStock: boolean;
}

// Sample product data for demonstration
const sampleProducts = [
	{ name: "Laptop Pro", price: 1299.99, category: "electronics", description: "High-performance laptop for professionals", inStock: true },
	{ name: "Wireless Headphones", price: 199.99, category: "electronics", description: "Noise-cancelling wireless headphones", inStock: true },
	{ name: "Running Shoes", price: 89.99, category: "sports", description: "Comfortable running shoes for all terrains", inStock: true },
	{ name: "Coffee Maker", price: 149.99, category: "home", description: "Programmable coffee maker with thermal carafe", inStock: false },
	{ name: "JavaScript Cookbook", price: 39.99, category: "books", description: "Essential recipes for modern JavaScript development", inStock: true },
	{ name: "Denim Jacket", price: 79.99, category: "clothing", description: "Classic denim jacket for casual wear", inStock: true },
	{ name: "Gaming Mouse", price: 59.99, category: "electronics", description: "High-DPI gaming mouse with RGB lighting", inStock: true },
	{ name: "Yoga Mat", price: 29.99, category: "sports", description: "Non-slip yoga mat for home workouts", inStock: false },
	{ name: "Plant Pot Set", price: 24.99, category: "home", description: "Ceramic plant pots in various sizes", inStock: true },
	{ name: "Novel Collection", price: 19.99, category: "books", description: "Bestselling novels in a beautiful box set", inStock: true }
];

export function ProductForm() {
	const dataStore = useDataStore();
	const [formData, setFormData] = useState<ProductFormData>({
		name: "",
		price: 0,
		category: "",
		description: "",
		inStock: true
	});

	// Query to get product count
	const productCount = useQuery<number>(
		c => dataStore.products.subscribe().count(r => {

			console.log("I RAN");

			c(r);
		}), 
		[]
	);

	// Query to get all products for display
	const products = useQuery<any[]>(
		c => {
			debugger;
			return dataStore.products.subscribe().toArray(c)
		},
		[]
	);

	console.log(products);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
		const { name, value, type } = e.target;
		setFormData(prev => ({
			...prev,
			[name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
					type === 'number' ? parseFloat(value) || 0 : value
		}));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		
		try {
			await dataStore.products.addAsync({
				...formData,
				more: {
					one: "default",
					two: "default"
				},
				cool: "default",
				two: "default"
			});

			await dataStore.saveChangesAsync();
			
			// Reset form
			setFormData({
				name: "",
				price: 0,
				category: "",
				description: "",
				inStock: true
			});
			
			alert("Product added successfully!");
		} catch (error) {
			console.error("Error adding product:", error);
			alert("Error adding product. Please try again.");
		}
	};

	const generateSampleData = async () => {
		try {
			for (const product of sampleProducts) {
				await dataStore.products.addAsync({
					...product,
					more: {
						one: "default",
						two: "default"
					},
					cool: "default",
					two: "default"
				});
			}

			await dataStore.saveChangesAsync();
		} catch (error) {
			console.error("Error adding sample products:", error);
			alert("Error adding sample products. Please try again.");
		}
	};

	return (
		<>
			<div className="form-section">
				<h2>Add New Product</h2>
				<form onSubmit={handleSubmit} className="product-form">
					<div className="form-group">
						<label htmlFor="name">Product Name *</label>
						<input
							type="text"
							id="name"
							name="name"
							value={formData.name}
							onChange={handleInputChange}
							required
							placeholder="Enter product name"
						/>
					</div>

					<div className="form-group">
						<label htmlFor="price">Price *</label>
						<input
							type="number"
							id="price"
							name="price"
							value={formData.price}
							onChange={handleInputChange}
							required
							min="0"
							step="0.01"
							placeholder="0.00"
						/>
					</div>

					<div className="form-group">
						<label htmlFor="category">Category</label>
						<select
							id="category"
							name="category"
							value={formData.category}
							onChange={handleInputChange}
						>
							<option value="">Select a category</option>
							<option value="electronics">Electronics</option>
							<option value="clothing">Clothing</option>
							<option value="books">Books</option>
							<option value="home">Home & Garden</option>
							<option value="sports">Sports</option>
							<option value="other">Other</option>
						</select>
					</div>

					<div className="form-group">
						<label htmlFor="description">Description</label>
						<textarea
							id="description"
							name="description"
							value={formData.description}
							onChange={handleInputChange}
							rows={3}
							placeholder="Enter product description"
						/>
					</div>

					<div className="form-group checkbox-group">
						<label>
							<input
								type="checkbox"
								name="inStock"
								checked={formData.inStock}
								onChange={handleInputChange}
							/>
							In Stock
						</label>
					</div>

					<div className="form-actions">
						<button type="submit" className="submit-btn">
							Add Product
						</button>
						<button type="button" onClick={generateSampleData} className="sample-btn">
							Generate Sample Data
						</button>
					</div>
				</form>
			</div>

			<div className="stats-section">
				<div className="stat-card">
					<h3>Total Products</h3>
					<p className="stat-number">
						{productCount.status === 'success' ? productCount.data : '...'}
					</p>
				</div>
			</div>

			{products.status === 'success' && products.data && products.data.length > 0 && (
				<div className="products-section">
					<h2>Recent Products</h2>
					<div className="products-grid">
						{products.data.slice(-6).reverse().map((product) => (
							<div key={product.id} className="product-card">
								<h4>{product.name}</h4>
								<p className="price">${product.price.toFixed(2)}</p>
								{product.category && <p className="category">{product.category}</p>}
								{product.description && <p className="description">{product.description}</p>}
								<span className={`stock-status ${product.inStock ? 'in-stock' : 'out-of-stock'}`}>
									{product.inStock ? 'In Stock' : 'Out of Stock'}
								</span>
							</div>
						))}
					</div>
				</div>
			)}
		</>
	);
}
