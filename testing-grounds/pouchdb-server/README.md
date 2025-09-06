# PouchDB Server Example

A PouchDB server setup using the official `pouchdb-server` package, designed to work with the Routier library.

## Features

- 🚀 **Official PouchDB Server** - Production-ready and well-tested
- 📊 **Full CouchDB API** - Complete compatibility with CouchDB
- 🔄 **CORS enabled** - Cross-origin requests supported
- 💾 **Flexible storage** - In-memory or persistent storage options
- 🔧 **Easy configuration** - Simple command-line options
- 🛡️ **Built-in security** - Authentication and SSL support

## Quick Start

### Option 1: Use Local Installation (Recommended)

```bash
# Install dependencies
npm install

# Start with in-memory storage (good for development)
npm start

# Start with persistent storage (good for production)
npm run start:persistent

# Start with custom port
PORT=3001 npm run start:custom-port
```

### Option 2: Use Global Installation

```bash
# Install globally
npm run install:global

# Start server
pouchdb-server --port 3000 --dir ./data --cors --in-memory
```

## Configuration Options

The server supports many command-line options:

```bash
pouchdb-server \
  --port 3000 \           # Server port (default: 5984)
  --dir ./data \          # Data directory
  --cors \                # Enable CORS
  --in-memory \           # Use in-memory storage
  --auth \                # Enable authentication
  --ssl \                 # Enable HTTPS
  --no-stdout-logs        # Disable console logging
```

## API Endpoints

The official PouchDB server provides the complete CouchDB API:

### Server Management

- `GET /` - Server information
- `GET /_up` - Health check
- `GET /_utils` - Fauxton admin interface

### Database Management

- `PUT /:db` - Create database
- `DELETE /:db` - Delete database
- `GET /:db` - Get database info

### Document Operations

- `POST /:db` - Create document
- `GET /:db/:docId` - Get document
- `PUT /:db/:docId` - Update document
- `DELETE /:db/:docId` - Delete document

### Query Operations

- `POST /:db/_find` - Find documents using Mango queries
- `POST /:db/_all_docs` - Get all documents
- `GET /:db/_design/:designDoc` - Design documents

### Changes Feed

- `GET /:db/_changes` - Get database changes

### Replication

- `POST /:db/_replicate` - Replicate databases

## Usage Examples

### Create a Database

```bash
curl -X PUT http://localhost:3000/myapp
```

### Create a Document

```bash
curl -X POST http://localhost:3000/myapp \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'
```

### Get a Document

```bash
curl http://localhost:3000/myapp/[document-id]
```

### Find Documents

```bash
curl -X POST http://localhost:3000/myapp/_find \
  -H "Content-Type: application/json" \
  -d '{"selector": {"name": {"$regex": "John"}}}'
```

## Development

### Available Scripts

- `npm start` - Start with in-memory storage
- `npm run start:persistent` - Start with persistent storage
- `npm run start:custom-port` - Start with custom port from environment
- `npm run install:global` - Install pouchdb-server globally
- `npm test` - Run the test script

### Project Structure

```
examples/pouchdb-server/
├── package.json          # Dependencies and scripts
├── README.md            # This documentation
├── test-server.js       # Test script
├── .gitignore           # Git ignore rules
└── data/                # Data directory (created on first run)
```

## Integration with Routier

This PouchDB server can be used as a backend for Routier applications. The server provides a RESTful API that follows CouchDB conventions, making it compatible with PouchDB clients and the Routier PouchDB plugin.

## Production Considerations

- **Storage**: Use persistent storage (`--dir ./data`) instead of in-memory
- **Security**: Enable authentication (`--auth`) for production use
- **SSL**: Use HTTPS (`--ssl`) for secure connections
- **Port**: Use standard CouchDB port 5984 or configure firewall rules
- **Monitoring**: Set up health checks and monitoring

## Troubleshooting

### Common Issues

1. **Port already in use**: Change the port with `--port` option
2. **Permission denied**: Ensure write access to the data directory
3. **CORS issues**: Make sure `--cors` flag is enabled

### Debug Mode

Enable verbose logging:

```bash
pouchdb-server --port 3000 --dir ./data --cors --verbose
```

### Check Server Status

```bash
curl http://localhost:3000/
```

## Why Official PouchDB Server?

- **Production Ready**: Used by many companies in production
- **Feature Complete**: Full CouchDB compatibility
- **Well Maintained**: Regular updates and security patches
- **Extensible**: Plugin system for custom functionality
- **Documented**: Extensive documentation and examples

## License

ISC
