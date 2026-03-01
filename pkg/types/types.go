package types

// ScrapeRequest represents a scrape API request
type ScrapeRequest struct {
	URL      string   `json:"url" vd:"len($)>0"`
	Formats  []string `json:"formats"`
	Options  *Options `json:"options,omitempty"`
}

// Options for scrape
type Options struct {
	WaitFor   string            `json:"waitFor,omitempty"`
	Timeout   int               `json:"timeout,omitempty"`
	Headers   map[string]string `json:"headers,omitempty"`
	Proxy     string            `json:"proxy,omitempty"`
	Selectors []string          `json:"selectors,omitempty"`
}

// ScrapeResponse represents scrape API response
type ScrapeResponse struct {
	Success  bool        `json:"success"`
	Data     *ScrapeData `json:"data,omitempty"`
	Error    string      `json:"error,omitempty"`
}

// ScrapeData contains the scraped content
type ScrapeData struct {
	Markdown  string            `json:"markdown,omitempty"`
	HTML      string            `json:"html,omitempty"`
	JSON      interface{}       `json:"json,omitempty"`
	Links     []string          `json:"links,omitempty"`
	Screenshot string           `json:"screenshot,omitempty"`
	Metadata  *Metadata         `json:"metadata,omitempty"`
}

// Metadata contains page metadata
type Metadata struct {
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`
	SourceURL   string `json:"sourceURL"`
	StatusCode  int    `json:"statusCode"`
}

// CrawlRequest represents crawl API request
type CrawlRequest struct {
	URL        string `json:"url" vd:"len($)>0"`
	MaxDepth   int    `json:"maxDepth,omitempty"`
	Concurrency int   `json:"concurrency,omitempty"`
	Limit      int    `json:"limit,omitempty"`
}

// CrawlResponse represents crawl API response
type CrawlResponse struct {
	Success bool       `json:"success"`
	Data    *CrawlData `json:"data,omitempty"`
	Error   string    `json:"error,omitempty"`
}

// CrawlData contains crawl results
type CrawlData struct {
	Pages   []PageResult `json:"pages"`
	Stats   *CrawlStats  `json:"stats,omitempty"`
}

// PageResult represents a single crawled page
type PageResult struct {
	URL      string `json:"url"`
	Markdown string `json:"markdown,omitempty"`
	Status   int    `json:"status"`
	Error    string `json:"error,omitempty"`
}

// CrawlStats contains crawl statistics
type CrawlStats struct {
	TotalURLs   int `json:"totalUrls"`
	SuccessURLs int `json:"successUrls"`
	FailedURLs  int `json:"failedUrls"`
	Depth       int `json:"depth"`
}

// HealthResponse represents health check response
type HealthResponse struct {
	Status    string `json:"status"`
	Playwright bool  `json:"playwright"`
}
