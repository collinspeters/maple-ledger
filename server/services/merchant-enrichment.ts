interface EnrichmentResult {
  enrichedContext: string;
  confidence: number;
  source: string;
}

export async function enrichMerchantDescription(
  rawDescription: string,
  amount?: number
): Promise<EnrichmentResult> {
  try {
    // Sanitize and prepare search query
    const sanitized = sanitizeDescription(rawDescription);
    const searchQuery = buildSearchQuery(sanitized);
    
    // Perform web search for merchant context
    const searchResults = await performWebSearch(searchQuery);
    
    // Extract meaningful context from search results
    const enrichedContext = extractMerchantContext(searchResults, sanitized);
    
    return {
      enrichedContext,
      confidence: enrichedContext.length > 50 ? 0.8 : 0.4,
      source: 'web_search'
    };
  } catch (error) {
    console.error("Merchant enrichment error:", error);
    return {
      enrichedContext: `Raw description: ${rawDescription}`,
      confidence: 0.2,
      source: 'fallback'
    };
  }
}

function sanitizeDescription(description: string): string {
  // Remove special characters and normalize
  let cleaned = description
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  
  // Extract meaningful parts (remove transaction codes, cities, provinces)
  const words = cleaned.split(' ');
  const meaningfulWords = words.filter(word => {
    // Filter out common transaction noise
    return !word.match(/^(PREAUTH|POS|DEBIT|CREDIT|PURCHASE|PAYMENT|TORONTO|ON|BC|AB|QC)$/);
  });
  
  // Take first 3-4 meaningful words for search
  return meaningfulWords.slice(0, 4).join(' ');
}

function buildSearchQuery(sanitized: string): string {
  // Build search query with merchant context sites
  const query = `"${sanitized}" merchant OR business OR store OR service`;
  return query;
}

async function performWebSearch(query: string): Promise<any[]> {
  try {
    // Use a simple web search approach - in production, you'd use SerpAPI
    // For now, we'll simulate with a basic fetch to get some context
    
    // This is a simplified version - in production you'd use SerpAPI:
    // const response = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${process.env.SERPAPI_KEY}`);
    
    // For this demo, we'll return mock structured results that represent what SerpAPI would return
    return [
      {
        title: `${query} - Business Information`,
        snippet: `Information about ${query} business operations and services`,
        link: "https://example.com"
      }
    ];
  } catch (error) {
    console.error("Web search error:", error);
    return [];
  }
}

function extractMerchantContext(searchResults: any[], sanitized: string): string {
  if (!searchResults || searchResults.length === 0) {
    return `Unknown merchant: ${sanitized}`;
  }
  
  // Extract meaningful context from search results
  const contexts = searchResults.map(result => {
    const snippet = result.snippet || '';
    const title = result.title || '';
    
    // Look for business type indicators
    const businessTypes = [
      'restaurant', 'retail', 'gas station', 'grocery', 'pharmacy', 
      'hotel', 'service', 'automotive', 'electronics', 'clothing',
      'hardware', 'coffee', 'fast food', 'convenience store'
    ];
    
    const foundTypes = businessTypes.filter(type => 
      snippet.toLowerCase().includes(type) || title.toLowerCase().includes(type)
    );
    
    if (foundTypes.length > 0) {
      return `${sanitized} appears to be related to ${foundTypes.join(', ')}`;
    }
    
    return snippet.substring(0, 100);
  });
  
  return contexts.filter(c => c.length > 0).join('. ') || `Merchant: ${sanitized}`;
}

// Cache for merchant enrichment to avoid redundant API calls
const enrichmentCache = new Map<string, EnrichmentResult>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function getCachedEnrichment(description: string): Promise<EnrichmentResult | null> {
  const cached = enrichmentCache.get(description);
  if (cached) {
    return cached;
  }
  return null;
}

export function setCachedEnrichment(description: string, result: EnrichmentResult): void {
  enrichmentCache.set(description, result);
  
  // Simple TTL cleanup (in production, use Redis with TTL)
  setTimeout(() => {
    enrichmentCache.delete(description);
  }, CACHE_TTL);
}