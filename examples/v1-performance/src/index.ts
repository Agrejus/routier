import { DataContext } from "routier";
import { PouchDbPlugin, PouchDbRecord } from "routier-plugin-pouchdb";
import * as fs from 'fs';
import * as path from 'path';

function randomString(length = 8) {
    const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

interface TestResult {
    itemCount: number;
    addTime: number;
    saveTime: number;
    totalTime: number;
    averageTimePerItem: number;
    timestamp: string;
}

// Declare document types
export enum MyDocumentTypes {
    Vehicle = "Vehicle",
    VehicleHistory = "VehicleHistory",
    Book = "Book"
}

// Declare models
export interface IVehicle extends PouchDbRecord<MyDocumentTypes.Vehicle> {
    make: string;
    model: string;
    year: number;
    color: string;
    trim: string;
}

// Create Data context using a provider
export class MyDataContext extends DataContext<MyDocumentTypes, PouchDbRecord<MyDocumentTypes>, "_id" | "_rev"> {

    contextId() {
        return MyDataContext.name;
    }

    constructor() {
        super({ dbName: `A_${randomString()}` }, PouchDbPlugin)
    }

    vehicles = this.dbset().default<IVehicle>(MyDocumentTypes.Vehicle).create();
}

// Data generation utilities
const makes = ["Chevrolet", "Ford", "Toyota", "Honda", "BMW", "Mercedes", "Audi", "Tesla"] as const;
type Make = typeof makes[number];

const models: Record<Make, string[]> = {
    Chevrolet: ["Silverado", "Malibu", "Camaro", "Corvette", "Tahoe"],
    Ford: ["F-150", "Mustang", "Explorer", "Escape", "Ranger"],
    Toyota: ["Camry", "Corolla", "RAV4", "Highlander", "Tacoma"],
    Honda: ["Civic", "Accord", "CR-V", "Pilot", "Odyssey"],
    BMW: ["3 Series", "5 Series", "X3", "X5", "M3"],
    Mercedes: ["C-Class", "E-Class", "GLC", "GLE", "S-Class"],
    Audi: ["A4", "A6", "Q5", "Q7", "RS"],
    Tesla: ["Model 3", "Model S", "Model X", "Model Y"]
};
const colors = ["Silver", "Black", "White", "Red", "Blue", "Gray", "Green"];
const trims = ["Base", "Sport", "Luxury", "RST", "RS", "GT", "Limited"];

function generateRandomVehicle(): Omit<IVehicle, '_id' | '_rev'> {
    const make = makes[Math.floor(Math.random() * makes.length)];
    const model = models[make][Math.floor(Math.random() * models[make].length)];
    const year = 2015 + Math.floor(Math.random() * 10);
    const color = colors[Math.floor(Math.random() * colors.length)];
    const trim = trims[Math.floor(Math.random() * trims.length)];

    return {
        make,
        model,
        year,
        color,
        trim,
        DocumentType: MyDocumentTypes.Vehicle
    };
}

function generateVehicles(count: number): Omit<IVehicle, '_id' | '_rev'>[] {
    return Array.from({ length: count }, () => generateRandomVehicle());
}

// Performance test function
async function runPerformanceTest(itemCount: number) {
    console.log(`\nRunning performance test with ${itemCount} items...`);
    const context = new MyDataContext();
    const vehicles = generateVehicles(itemCount);

    // Test adding items
    const addStart = performance.now();
    for (const vehicle of vehicles) {
        await context.vehicles.add(vehicle);
    }
    const addEnd = performance.now();
    const addTime = addEnd - addStart;

    // Test saving changes
    const saveStart = performance.now();
    await context.saveChanges();
    const saveEnd = performance.now();
    const saveTime = saveEnd - saveStart;

    const totalTime = addTime + saveTime;
    const averageTimePerItem = totalTime / itemCount;

    await context.destroyDatabase();

    return {
        itemCount,
        addTime,
        saveTime,
        totalTime,
        averageTimePerItem,
        timestamp: new Date().toISOString()
    };
}

// Run tests with different sizes
const run = async () => {
    const testSizes = [1, 5, 10, 100, 1000, 10_000];
    const results: TestResult[] = [];

    console.log("Starting performance tests...");
    for (const size of testSizes) {
        for (let i = 0; i < 100; i++) {
            const result = await runPerformanceTest(size);
            results.push(result);
        }
    }
    console.log("\nPerformance tests completed!");

    // Write results to file
    const outputDir = path.join(__dirname, 'results');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(outputDir, `performance-results-${timestamp}.json`);

    // Calculate averages for each item count
    const averages = testSizes.map(size => {
        const sizeResults = results.filter(r => r.itemCount === size);
        const avgAddTime = sizeResults.reduce((sum, r) => sum + r.addTime, 0) / sizeResults.length;
        const avgSaveTime = sizeResults.reduce((sum, r) => sum + r.saveTime, 0) / sizeResults.length;
        const avgTotalTime = sizeResults.reduce((sum, r) => sum + r.totalTime, 0) / sizeResults.length;
        const avgTimePerItem = sizeResults.reduce((sum, r) => sum + r.averageTimePerItem, 0) / sizeResults.length;

        return {
            itemCount: size,
            averageAddTime: avgAddTime,
            averageSaveTime: avgSaveTime,
            averageTotalTime: avgTotalTime,
            averageTimePerItem: avgTimePerItem,
            sampleCount: sizeResults.length
        };
    });

    const output = {
        timestamp,
        testSizes,
        averages,
        rawResults: results
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\nResults written to: ${outputPath}`);
}

run();