import { useRef, useState } from "react";
import reactLogo from "./assets/react.svg";
import "./App.css";
import { CustomContext, useDataStore } from './CustomContext';
import { useQuery } from "./useQuery";

function App() {
	const [count, setCount] = useState(0);
	const dataStore = useDataStore();
	const productCount = useQuery<number>(c => dataStore.products.count(c), []);
	const contextRef = useRef(new CustomContext());

	const onClick = async () => {

		const result = await contextRef.current.products.where(x => x.name === "James").firstOrUndefinedAsync();

		console.log(result);
		debugger;

		const [first] = await contextRef.current.products.addAsync({
			cool: "cool2",
			two: "two2",
			name: "James1",
			more: {
				one: "one",
				two: "two"
			},
			order: 1000
		}, {
			cool: "cool1",
			two: "two1",
			name: "James",
			more: {
				one: "one",
				two: "two"
			},
			order: 10
		});

		const response = await contextRef.current.saveChangesAsync();

		await contextRef.current.products.removeAsync(first);

		await contextRef.current.saveChangesAsync();

		const items = await contextRef.current.products.toArrayAsync();

		debugger
		console.log(items);

		setCount(items.length)
	}

	return (
		<div className="App">
			<div>
				<a href="https://reactjs.org" target="_blank" rel="noreferrer">
					<img src={reactLogo} className="logo react" alt="React logo" />
				</a>
			</div>
			<h1>Rspack + React + TypeScript</h1>
			<div className="card">
				<button type="button" onClick={onClick}>
					count is {count}
				</button>
				<p>
					Edit <code>src/App.tsx</code> and save to test HMR
				</p>
			</div>
			<p className="read-the-docs">
				Click on the Rspack and React logos to learn more
			</p>
			{productCount.status === 'success' ? productCount.data : 0}
		</div>
	);
}

export default App;
