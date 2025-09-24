# Routier Scripts

This directory contains utility scripts for managing the Routier monorepo.

## Available Scripts

### `bump-version.mjs`

A comprehensive script for bumping package versions across the entire monorepo.

#### Overview

This script updates all references to a specific package version across all `package.json` files in the monorepo. It's designed to handle the complexity of maintaining consistent versions across multiple packages in a Lerna-managed monorepo.

#### Features

- 🔍 **Recursive Discovery**: Automatically finds all `package.json` files in the monorepo
- 📦 **Multiple Dependency Types**: Updates `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies`
- 🎯 **Package Self-Versioning**: Updates the package's own version when the package name matches
- 📋 **Lerna Integration**: Updates `lerna.json` version when appropriate
- 🔒 **Prefix Preservation**: Maintains version prefixes like `^`, `~`, `>=`, `<=`, etc.
- 🚫 **File Protocol Skip**: Ignores `file:` protocol dependencies (local development)
- ✅ **Safe Operation**: Provides detailed output and allows review before committing
- 🔄 **Idempotent**: Can be run multiple times safely

#### Usage

```bash
# Using npm script (recommended)
npm run bump <package-name> <new-version>

# Direct execution
node scripts/bump-version.mjs <package-name> <new-version>
```

#### Examples

```bash
# Bump @routier/core to 0.0.1-alpha.10
npm run bump @routier/core 0.0.1-alpha.10

# Bump @routier/datastore to 0.0.1-alpha.5
npm run bump @routier/datastore 0.0.1-alpha.5

# Bump @routier/memory-plugin to 0.0.1-alpha.3
npm run bump @routier/memory-plugin 0.0.1-alpha.3

# Bump @routier/react to 0.0.1-alpha.2
npm run bump @routier/react 0.0.1-alpha.2
```

#### What Gets Updated

The script updates the following in all relevant `package.json` files:

1. **Dependencies**: `dependencies[packageName] = prefix + newVersion` (preserves `^`, `~`, etc.)
2. **Dev Dependencies**: `devDependencies[packageName] = prefix + newVersion` (preserves `^`, `~`, etc.)
3. **Peer Dependencies**: `peerDependencies[packageName] = prefix + newVersion` (preserves `^`, `~`, etc.)
4. **Optional Dependencies**: `optionalDependencies[packageName] = prefix + newVersion` (preserves `^`, `~`, etc.)
5. **Package Version**: `version = newVersion` (no prefix for package's own version)
6. **Lerna Version**: Updates `lerna.json` version for root packages

#### Version Prefix Preservation

The script intelligently preserves version prefixes:

- `^0.0.1-alpha.5` → `^0.0.1-alpha.10` (keeps `^`)
- `~0.0.1-alpha.5` → `~0.0.1-alpha.10` (keeps `~`)
- `>=0.0.1-alpha.5` → `>=0.0.1-alpha.10` (keeps `>=`)
- `0.0.1-alpha.5` → `0.0.1-alpha.10` (no prefix, stays no prefix)

#### File Protocol Dependencies

The script automatically skips `file:` protocol dependencies (local development references):

- `file:../core` → **skipped** (local development)
- `file:../../plugins/memory` → **skipped** (local development)
- `^0.0.1-alpha.5` → `^0.0.1-alpha.10` (updated normally)

#### Example Output

```bash
$ npm run bump @routier/core 0.0.1-alpha.10

🔄 Bumping @routier/core to version 0.0.1-alpha.10...
📁 Found 8 package.json files
✅ Updated datastore/package.json
✅ Updated plugins/pouchdb/package.json
✅ Updated plugins/memory/package.json
✅ Updated plugins/dexie/package.json
✅ Updated plugins/file-system/package.json
✅ Updated plugins/sqlite/package.json
✅ Updated plugins/browser-storage/package.json
✅ Updated react/package.json

🎉 Successfully updated 8 files

📋 Next steps:
  1. Review the changes: git diff
  2. Commit the changes: git add . && git commit -m "chore: bump @routier/core to 0.0.1-alpha.10"
  3. Publish if needed: lerna publish from-git
```

#### Workflow Integration

This script is designed to work seamlessly with your existing Lerna workflow:

1. **Development**: Use this script to bump versions during development
2. **Review**: Always review changes with `git diff` before committing
3. **Commit**: Commit the version changes
4. **Publish**: Use `lerna publish from-git` to publish the updated packages

#### Comparison with Lerna

| Feature                   | Lerna `version` | This Script |
| ------------------------- | --------------- | ----------- |
| Specific version setting  | ❌              | ✅          |
| Conventional commits only | ✅              | ❌          |
| All packages at once      | ❌              | ✅          |
| Dependency updates        | ✅              | ✅          |
| Detailed output           | ❌              | ✅          |
| Safe operation            | ✅              | ✅          |

#### Error Handling

The script includes comprehensive error handling:

- **Invalid arguments**: Shows usage information
- **File not found**: Gracefully handles missing files
- **JSON parsing errors**: Provides clear error messages
- **Permission errors**: Indicates file access issues

#### Prerequisites

- Node.js 18+ (for ES modules support)
- Access to the monorepo root directory
- Write permissions to package.json files

#### Troubleshooting

**Script not found:**

```bash
# Make sure you're in the monorepo root
cd /path/to/routier
npm run bump @routier/core 0.0.1-alpha.10
```

**Permission denied:**

```bash
# Make the script executable
chmod +x scripts/bump-version.mjs
```

**No changes detected:**

- Verify the package name is correct
- Check if the package exists in any package.json files
- Ensure the version format is valid

#### Contributing

When modifying this script:

1. Test with a dry run first
2. Update this README if adding new features
3. Ensure backward compatibility
4. Add appropriate error handling

#### License

This script is part of the Routier project and follows the same MIT license.
