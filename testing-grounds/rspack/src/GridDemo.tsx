import { useDataStore } from './DexieStore';
import { Product } from './schemas/product';
import { useQuery } from "@routier/react";
import { useState, useMemo } from "react";

interface GridFilters {
	search: string;
	category: string;
	minPrice: number;
	maxPrice: number;
	inStock: boolean | null;
}

export function GridDemo() {
	const dataStore = useDataStore();
	const [filters, setFilters] = useState<GridFilters>({
		search: "",
		category: "",
		minPrice: 0,
		maxPrice: 1000,
		inStock: null
	});
	const [sortField, setSortField] = useState<keyof Product>("name");
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage, setItemsPerPage] = useState(10);

	// Calculate skip value for pagination
	const skip = (currentPage - 1) * itemsPerPage;

	// Query to get products with pagination using Routier's skip/take
	const products = useQuery<Product[]>(
		c => dataStore.products
			.subscribe()
			.skip(skip)
			.take(itemsPerPage)
			.toArray(c),
		[skip, itemsPerPage]
	);

	// Query to get total count for pagination
	const totalCount = useQuery<number>(
		c => dataStore.products.subscribe().count(c),
		[]
	);

	// Apply filters and sorting
	const filteredAndSortedProducts = useMemo(() => {
		if (products.status !== 'success' || !products.data) return [];

		let filtered = products.data.filter(product => {
			// Search filter
			if (filters.search && !product.name.toLowerCase().includes(filters.search.toLowerCase()) &&
				!product.description?.toLowerCase().includes(filters.search.toLowerCase())) {
				return false;
			}

			// Category filter
			if (filters.category && product.category !== filters.category) {
				return false;
			}

			// Price range filter
			if (product.price < filters.minPrice || product.price > filters.maxPrice) {
				return false;
			}

			// Stock filter
			if (filters.inStock !== null && product.inStock !== filters.inStock) {
				return false;
			}

			return true;
		});

		// Apply sorting
		filtered.sort((a, b) => {
			let aValue = a[sortField];
			let bValue = b[sortField];

			// Handle string comparison
			if (typeof aValue === 'string' && typeof bValue === 'string') {
				aValue = aValue.toLowerCase();
				bValue = bValue.toLowerCase();
			}

			if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
			if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
			return 0;
		});

		return filtered;
	}, [products.data, products.status, filters, sortField, sortDirection]);

	// Calculate total pages based on total count
	const totalPages = Math.ceil((totalCount.status === 'success' ? totalCount.data : 0) / itemsPerPage);

	// Get unique categories for filter dropdown
	const categories = useMemo(() => {
		if (products.status !== 'success' || !products.data) return [];
		return [...new Set(products.data.map(p => p.category).filter(Boolean))];
	}, [products.data, products.status]);

	const handleFilterChange = (field: keyof GridFilters, value: any) => {
		setFilters(prev => ({ ...prev, [field]: value }));
		setCurrentPage(1); // Reset to first page when filters change
	};

	const handleSort = (field: keyof Product) => {
		if (sortField === field) {
			setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
		} else {
			setSortField(field);
			setSortDirection('asc');
		}
		setCurrentPage(1);
	};

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
		// The useQuery will automatically re-run due to the skip dependency change
	};

	const handlePageSizeChange = (newPageSize: number) => {
		setItemsPerPage(newPageSize);
		setCurrentPage(1); // Reset to first page when page size changes
		// The useQuery will automatically re-run due to the itemsPerPage dependency change
	};

	const SortIcon = ({ field }: { field: string }) => {
		if (sortField !== field) return <span className="sort-icon">↕</span>;
		return <span className="sort-icon">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
	};

	return (
		<div className="grid-demo">
			<div className="filters-section">
				<h2>Product Grid with Advanced Filtering</h2>
				<p className="demo-description">
					This demonstrates Routier's powerful querying capabilities with real-time filtering, sorting, and pagination using native skip/take.
				</p>

				<div className="filters-grid">
					<div className="filter-group">
						<label>Search</label>
						<input
							type="text"
							placeholder="Search products..."
							value={filters.search}
							onChange={(e) => handleFilterChange('search', e.target.value)}
						/>
					</div>

					<div className="filter-group">
						<label>Category</label>
						<select
							value={filters.category}
							onChange={(e) => handleFilterChange('category', e.target.value)}
						>
							<option value="">All Categories</option>
							{categories.map(cat => (
								<option key={cat} value={cat}>{cat}</option>
							))}
						</select>
					</div>

					<div className="filter-group">
						<label>Min Price</label>
						<input
							type="number"
							min="0"
							value={filters.minPrice}
							onChange={(e) => handleFilterChange('minPrice', parseFloat(e.target.value) || 0)}
						/>
					</div>

					<div className="filter-group">
						<label>Max Price</label>
						<input
							type="number"
							min="0"
							value={filters.maxPrice}
							onChange={(e) => handleFilterChange('maxPrice', parseFloat(e.target.value) || 1000)}
						/>
					</div>

					<div className="filter-group">
						<label>Stock Status</label>
						<select
							value={filters.inStock === null ? '' : filters.inStock.toString()}
							onChange={(e) => handleFilterChange('inStock', e.target.value === '' ? null : e.target.value === 'true')}
						>
							<option value="">All</option>
							<option value="true">In Stock</option>
							<option value="false">Out of Stock</option>
						</select>
					</div>

					<div className="filter-group">
						<label>Items Per Page</label>
						<select
							value={itemsPerPage}
							onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
						>
							<option value={5}>5 per page</option>
							<option value={10}>10 per page</option>
							<option value={25}>25 per page</option>
							<option value={50}>50 per page</option>
							<option value={100}>100 per page</option>
						</select>
					</div>
				</div>

				<div className="results-summary">
					<p>
						Showing page {currentPage} of {totalPages} 
						({totalCount.status === 'success' ? totalCount.data : '...'} total products)
					</p>
					<p className="page-info">
						Displaying items {(skip + 1)}-{Math.min(skip + itemsPerPage, totalCount.status === 'success' ? totalCount.data : 0)} 
						of {totalCount.status === 'success' ? totalCount.data : '...'} total
					</p>
				</div>
			</div>

			<div className="grid-section">
				<div className="grid-header">
					<table className="data-grid">
						<thead>
							<tr>
								<th onClick={() => handleSort('name')} className="sortable">
									Name <SortIcon field="name" />
								</th>
								<th onClick={() => handleSort('price')} className="sortable">
									Price <SortIcon field="price" />
								</th>
								<th onClick={() => handleSort('category')} className="sortable">
									Category <SortIcon field="category" />
								</th>
								<th onClick={() => handleSort('inStock')} className="sortable">
									Stock <SortIcon field="inStock" />
								</th>
								<th>Description</th>
							</tr>
						</thead>
						<tbody>
							{filteredAndSortedProducts.map((product) => (
								<tr key={product._id}>
									<td className="product-name">{product.name}</td>
									<td className="product-price">${product.price.toFixed(2)}</td>
									<td className="product-category">{product.category || '-'}</td>
									<td>
										<span className={`stock-status ${product.inStock ? 'in-stock' : 'out-of-stock'}`}>
											{product.inStock ? 'In Stock' : 'Out of Stock'}
										</span>
									</td>
									<td className="product-description">
										{product.description || 'No description'}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{totalPages > 1 && (
					<div className="pagination">
						<button
							onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
							disabled={currentPage === 1}
							className="pagination-btn"
						>
							Previous
						</button>
						
						<div className="page-numbers">
							{Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
								<button
									key={page}
									onClick={() => handlePageChange(page)}
									className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
								>
									{page}
								</button>
							))}
						</div>

						<button
							onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
							disabled={currentPage === totalPages}
							className="pagination-btn"
						>
							Next
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
