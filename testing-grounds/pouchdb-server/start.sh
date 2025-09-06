#!/bin/bash

# PouchDB Server Startup Script
# This script provides easy access to different server configurations

echo "🚀 PouchDB Server Startup Script"
echo "================================"

# Check if pouchdb-server is installed
if ! command -v pouchdb-server &> /dev/null; then
    echo "❌ pouchdb-server not found. Installing..."
    npm install -g pouchdb-server
fi

# Function to show usage
show_usage() {
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  dev          Start with in-memory storage (development)"
    echo "  prod         Start with persistent storage (production)"
    echo "  custom       Start with custom port from PORT environment variable"
    echo "  help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 dev                    # Start on port 3000 with in-memory storage"
    echo "  $0 prod                   # Start on port 3000 with persistent storage"
    echo "  PORT=3001 $0 custom      # Start on port 3001 with persistent storage"
    echo ""
}

# Function to start development server
start_dev() {
    echo "🔧 Starting development server (in-memory storage)..."
    echo "📍 Port: 3000"
    echo "💾 Storage: In-memory"
    echo "🌐 CORS: Enabled"
    echo "📊 Admin: http://localhost:3000/_utils"
    echo ""
    pouchdb-server --port 3000 --dir ./data --cors --in-memory
}

# Function to start production server
start_prod() {
    echo "🏭 Starting production server (persistent storage)..."
    echo "📍 Port: 3000"
    echo "💾 Storage: Persistent (./data)"
    echo "🌐 CORS: Enabled"
    echo "📊 Admin: http://localhost:3000/_utils"
    echo ""
    pouchdb-server --port 3000 --dir ./data --cors
}

# Function to start custom server
start_custom() {
    PORT=${PORT:-3000}
    echo "⚙️  Starting custom server..."
    echo "📍 Port: $PORT"
    echo "💾 Storage: Persistent (./data)"
    echo "🌐 CORS: Enabled"
    echo "📊 Admin: http://localhost:$PORT/_utils"
    echo ""
    pouchdb-server --port $PORT --dir ./data --cors
}

# Main script logic
case "${1:-dev}" in
    "dev")
        start_dev
        ;;
    "prod")
        start_prod
        ;;
    "custom")
        start_custom
        ;;
    "help"|"-h"|"--help")
        show_usage
        ;;
    *)
        echo "❌ Unknown option: $1"
        show_usage
        exit 1
        ;;
esac
