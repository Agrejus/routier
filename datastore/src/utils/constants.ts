/**
 * Constants used throughout the sync system
 */
export const SYNC_CONSTANTS = {
    /**
     * Special marker for sync events in recordIds
     * Used to track when we successfully fetched from the server
     */
    SYNC_MARKER: '__sync__',
    
    /**
     * API endpoint paths for sync server
     */
    ENDPOINTS: {
        /**
         * GET endpoint to fetch current server timestamps for all tables
         */
        TIMESTAMPS: '/api/sync/timestamps',
        
        /**
         * GET endpoint to fetch changes since a given timestamp
         */
        CHANGES: '/api/sync/changes',
        
        /**
         * POST endpoint to send local changes to the server
         */
        POST_CHANGES: '/api/sync/changes',
        
        /**
         * GET endpoint for Server-Sent Events (SSE) real-time change streaming
         */
        CHANGES_STREAM: '/api/sync/changes/stream',
        
        /**
         * GET endpoint for health check
         */
        HEALTH: '/health'
    },
    
    /**
     * Query parameter names for API endpoints
     */
    QUERY_PARAMS: {
        TABLE: 'table',
        SINCE: 'since',
        LIMIT: 'limit',
        CLIENT_ID: 'clientId'
    },
    
    /**
     * SSE endpoint path (kept for backward compatibility)
     * @deprecated Use ENDPOINTS.CHANGES_STREAM instead
     */
    SSE_ENDPOINT: '/api/sync/changes/stream',
    
    /**
     * Query parameter names for SSE (kept for backward compatibility)
     * @deprecated Use QUERY_PARAMS instead
     */
    SSE_PARAMS: {
        TABLE: 'table',
        SINCE: 'since',
        CLIENT_ID: 'clientId'
    }
} as const;
