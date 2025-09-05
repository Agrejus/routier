import { DataContext } from "routier";
import { InferType, s } from "@routier/core";
import { PouchDbPlugin } from "routier-plugin-pouchdb";
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

const vehicle = s.define("vehicles", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    make: s.string(),
    model: s.string(),
    year: s.number(),
    color: s.string(),
    trim: s.string(),
}).modify(w => ({
    DocumentType: w.computed((_, t) => t).tracked()
})).compile();

// Create Data context using a provider
export class MyDataContext extends DataContext {

    constructor() {
        super(new PouchDbPlugin(`A_${randomString()}`))
    }

    vehicles = this.collection(vehicle).create();
}

type Vehicle = InferType<typeof vehicle>;

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

function generateRandomVehicle(): Omit<Vehicle, '_id' | '_rev' | 'DocumentType'> {
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
        trim
    };
}

function generateVehicles(count: number): Omit<Vehicle, '_id' | '_rev' | 'DocumentType'>[] {
    return Array.from({ length: count }, () => generateRandomVehicle());
}

interface TestResult {
    itemCount: number;
    addTime: number;
    saveTime: number;
    totalTime: number;
    averageTimePerItem: number;
    timestamp: string;
}

// Performance test function
async function runPerformanceTest(itemCount: number): Promise<TestResult> {
    console.log(`\nRunning performance test with ${itemCount} items...`);
    const context = new MyDataContext();
    const vehicles = generateVehicles(itemCount);

    // Test adding items
    const addStart = performance.now();
    for (const vehicle of vehicles) {
        await context.vehicles.addAsync(vehicle);
    }
    const addEnd = performance.now();
    const addTime = addEnd - addStart;

    // Test saving changes
    const saveStart = performance.now();
    await context.saveChangesAsync();

    const saveEnd = performance.now();
    const saveTime = saveEnd - saveStart;

    const totalTime = addTime + saveTime;
    const averageTimePerItem = totalTime / itemCount;


    await context.destroyAsync();

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