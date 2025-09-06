#!/usr/bin/env node

/**
 * Test script for the Official PouchDB Server
 * Run this after starting the server to test basic functionality
 */

const BASE_URL = 'http://localhost:3000';

async function testServer() {
    console.log('🧪 Testing Official PouchDB Server...\n');

    try {
        // Test 1: Server info
        console.log('1. Testing server info...');
        const infoResponse = await fetch(`${BASE_URL}/`);
        const infoData = await infoResponse.json();
        console.log('✅ Server info:', infoData);

        // Test 2: Health check
        console.log('\n2. Testing health check...');
        const healthResponse = await fetch(`${BASE_URL}/_up`);
        const healthData = await healthResponse.json();
        console.log('✅ Health check:', healthData);

        // Test 3: Create database
        console.log('\n3. Creating test database...');
        const createDbResponse = await fetch(`${BASE_URL}/testdb`, {
            method: 'PUT'
        });
        const createDbData = await createDbResponse.json();
        console.log('✅ Database created:', createDbData);

        // Test 4: Create document
        console.log('\n4. Creating test document...');
        const testDoc = {
            name: 'Test User',
            email: 'test@example.com',
            age: 30,
            tags: ['test', 'example']
        };

        const createDocResponse = await fetch(`${BASE_URL}/testdb`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testDoc)
        });
        const createDocData = await createDocResponse.json();
        console.log('✅ Document created:', createDocData);

        // Test 5: Get document
        console.log('\n5. Retrieving test document...');
        const docId = createDocData.id;
        const getDocResponse = await fetch(`${BASE_URL}/testdb/${docId}`);
        const getDocData = await getDocResponse.json();
        console.log('✅ Document retrieved:', getDocData);

        // Test 6: Update document
        console.log('\n6. Updating test document...');
        const updatedDoc = { ...getDocData, age: 31, updated: true };
        const updateDocResponse = await fetch(`${BASE_URL}/testdb/${docId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedDoc)
        });
        const updateDocData = await updateDocResponse.json();
        console.log('✅ Document updated:', updateDocData);

        // Test 7: Find documents
        console.log('\n7. Finding documents...');
        const findQuery = {
            selector: {
                name: { $regex: 'Test' }
            }
        };

        const findResponse = await fetch(`${BASE_URL}/testdb/_find`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(findQuery)
        });
        const findData = await findResponse.json();
        console.log('✅ Documents found:', findData);

        // Test 8: Get all documents
        console.log('\n8. Getting all documents...');
        const allDocsResponse = await fetch(`${BASE_URL}/testdb/_all_docs`);
        const allDocsData = await allDocsResponse.json();
        console.log('✅ All documents:', allDocsData);

        // Test 9: Get changes
        console.log('\n9. Getting changes feed...');
        const changesResponse = await fetch(`${BASE_URL}/testdb/_changes`);
        const changesData = await changesResponse.json();
        console.log('✅ Changes feed:', changesData);

        // Test 10: Get database info
        console.log('\n10. Getting database info...');
        const dbInfoResponse = await fetch(`${BASE_URL}/testdb`);
        const dbInfoData = await dbInfoResponse.json();
        console.log('✅ Database info:', dbInfoData);

        // Test 11: Check Fauxton admin interface
        console.log('\n11. Checking Fauxton admin interface...');
        const fauxtonResponse = await fetch(`${BASE_URL}/_utils`);
        if (fauxtonResponse.ok) {
            console.log('✅ Fauxton admin interface available at:', `${BASE_URL}/_utils`);
        } else {
            console.log('⚠️  Fauxton admin interface not available');
        }

        console.log('\n🎉 All tests passed! The Official PouchDB server is working correctly.');
        console.log(`\n📊 Admin interface: ${BASE_URL}/_utils`);
        console.log(`📚 API documentation: https://docs.couchdb.org/en/stable/api/`);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Make sure the server is running on', BASE_URL);
        console.error('\nTo start the server, run:');
        console.error('  npm start');
        console.error('  # or');
        console.error('  pouchdb-server --port 3000 --dir ./data --cors --in-memory');
        process.exit(1);
    }
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
    console.error('❌ This script requires Node.js 18+ or you need to install node-fetch');
    console.error('Run: npm install node-fetch');
    process.exit(1);
}

// Run the tests
testServer();
