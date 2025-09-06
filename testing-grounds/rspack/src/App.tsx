import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import routierLogo from "../../../docs/assets/routier.svg";
import "./App.css";
import { ProductForm } from './ProductForm';
import { GridDemo } from './GridDemo';
import { ReactiveDemo } from './ReactiveDemo';

function App() {
	return (
		<Router>
			<div className="App">
				<header className="app-header">
					<div className="logo-container">
						<img src={routierLogo} className="logo routier" alt="Routier logo" />
						<h1>Routier Demo</h1>
					</div>
					<p className="subtitle">Universal ORM abstraction that lets you easily switch between different ORM frameworks and data stores</p>
					
					<nav className="app-navigation">
						<Link to="/" className="nav-link">Product Form</Link>
						<Link to="/grid" className="nav-link">Grid Demo</Link>
						<Link to="/reactive" className="nav-link">Reactive vs Non-Reactive</Link>
					</nav>
				</header>

				<main className="app-main">
					<Routes>
						<Route path="/" element={<ProductForm />} />
						<Route path="/grid" element={<GridDemo />} />
						<Route path="/reactive" element={<ReactiveDemo />} />
					</Routes>
				</main>
			</div>
		</Router>
	);
}

export default App;
