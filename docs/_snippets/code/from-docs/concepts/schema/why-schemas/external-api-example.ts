// External API responses - schemas may not be needed
interface ExternalApiResponse {
    data: any; // Unknown structure from external API
    status: string;
    timestamp: string;
}

// For data from external APIs with unknown or changing structure,
// schemas may be too rigid and require constant updates
// Consider using TypeScript interfaces or validation libraries instead
