#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

/**
 * Recursively find all package.json files in the monorepo
 */
function findPackageJsonFiles(dir, files = []) {
    const items = readdirSync(dir);

    for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
            // Skip node_modules and .git directories
            if (item === 'node_modules' || item === '.git' || item === 'dist') {
                continue;
            }
            findPackageJsonFiles(fullPath, files);
        } else if (item === 'package.json') {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Update package.json file with new version
 */
function updatePackageJson(filePath, packageName, newVersion) {
    const content = readFileSync(filePath, 'utf8');
    const packageJson = JSON.parse(content);
    let updated = false;

    // Update dependencies
    if (packageJson.dependencies && packageJson.dependencies[packageName]) {
        packageJson.dependencies[packageName] = newVersion;
        updated = true;
    }

    // Update devDependencies
    if (packageJson.devDependencies && packageJson.devDependencies[packageName]) {
        packageJson.devDependencies[packageName] = newVersion;
        updated = true;
    }

    // Update peerDependencies
    if (packageJson.peerDependencies && packageJson.peerDependencies[packageName]) {
        packageJson.peerDependencies[packageName] = newVersion;
        updated = true;
    }

    // Update optionalDependencies
    if (packageJson.optionalDependencies && packageJson.optionalDependencies[packageName]) {
        packageJson.optionalDependencies[packageName] = newVersion;
        updated = true;
    }

    // Update the package's own version if it matches the package name
    if (packageJson.name === packageName) {
        packageJson.version = newVersion;
        updated = true;
    }

    if (updated) {
        writeFileSync(filePath, JSON.stringify(packageJson, null, 2) + '\n');
        return true;
    }

    return false;
}

/**
 * Update lerna.json version
 */
function updateLernaJson(packageName, newVersion) {
    const lernaPath = join(rootDir, 'lerna.json');
    const content = readFileSync(lernaPath, 'utf8');
    const lernaJson = JSON.parse(content);

    // Only update if this is the root package version
    if (packageName === 'routier-collection' || packageName === 'routier') {
        lernaJson.version = newVersion;
        writeFileSync(lernaPath, JSON.stringify(lernaJson, null, 2) + '\n');
        return true;
    }

    return false;
}

/**
 * Update any other files that might reference the package version
 */
function updateOtherFiles(packageName, newVersion) {
    const filesToCheck = [
        'README.md',
        'docs/**/*.md',
        'examples/**/package.json',
        'scripts/**/*.js',
        'scripts/**/*.mjs'
    ];

    // This is a simplified version - you might want to add more sophisticated file searching
    // For now, we'll focus on package.json files which are the most important
    return 0;
}

/**
 * Main function
 */
function main() {
    const args = process.argv.slice(2);

    if (args.length !== 2) {
        console.log('Usage: node bump-version.mjs <package-name> <new-version>');
        console.log('');
        console.log('Examples:');
        console.log('  node bump-version.mjs @routier/core 0.0.1-alpha.10');
        console.log('  node bump-version.mjs @routier/datastore 0.0.1-alpha.5');
        console.log('  node bump-version.mjs @routier/memory-plugin 0.0.1-alpha.3');
        process.exit(1);
    }

    const [packageName, newVersion] = args;

    console.log(`🔄 Bumping ${packageName} to version ${newVersion}...`);

    // Find all package.json files
    const packageJsonFiles = findPackageJsonFiles(rootDir);
    console.log(`📁 Found ${packageJsonFiles.length} package.json files`);

    let updatedFiles = 0;

    // Update each package.json file
    for (const filePath of packageJsonFiles) {
        const relativePath = filePath.replace(rootDir + '/', '');
        const wasUpdated = updatePackageJson(filePath, packageName, newVersion);

        if (wasUpdated) {
            console.log(`✅ Updated ${relativePath}`);
            updatedFiles++;
        }
    }

    // Update lerna.json if needed
    const lernaUpdated = updateLernaJson(packageName, newVersion);
    if (lernaUpdated) {
        console.log('✅ Updated lerna.json');
        updatedFiles++;
    }

    console.log('');
    console.log(`🎉 Successfully updated ${updatedFiles} files`);
    console.log('');
    console.log('📋 Next steps:');
    console.log('  1. Review the changes: git diff');
    console.log('  2. Commit the changes: git add . && git commit -m "chore: bump ' + packageName + ' to ' + newVersion + '"');
    console.log('  3. Publish if needed: lerna publish from-git');
}

// Run the script
main();
