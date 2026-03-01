package scraper

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/nevernet/web-fetch/pkg/types"
	"github.com/playwright/playwright"
)

var pw *playwright.Playwright
var browser playwright.Browser

// Init initializes Playwright
func Init(ctx context.Context) error {
	var err error
	pw, err = playwright.Run()
	if err != nil {
		return fmt.Errorf("playwright run error: %w", err)
	}

	browser, err = pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
		Headless: playwright.Bool(true),
		Args: []string{
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-blink-features=AutomationControlled",
		},
	})
	if err != nil {
		return fmt.Errorf("browser launch error: %w", err)
	}

	log.Println("Playwright initialized successfully")
	return nil
}

// Close closes Playwright
func Close(ctx context.Context) {
	if browser != nil {
		browser.Close()
	}
	if pw != nil {
		pw.Stop()
	}
}

// IsInitialized returns whether Playwright is initialized
func IsInitialized() bool {
	return browser != nil
}

// Scrape scrapes a URL and returns the content
func Scrape(ctx context.Context, req *types.ScrapeRequest) (*types.ScrapeResponse, error) {
	resp := &types.ScrapeResponse{
		Success: false,
	}

	// Validate URL
	if req.URL == "" {
		resp.Error = "url is required"
		return resp, nil
	}

	// Default formats
	if len(req.Formats) == 0 {
		req.Formats = []string{"markdown"}
	}

	// Default timeout
	timeout := 30000
	if req.Options != nil && req.Options.Timeout > 0 {
		timeout = req.Options.Timeout
	}

	// Try Playwright first if available
	if browser != nil {
		return scrapeWithPlaywright(ctx, req, timeout)
	}

	// Fallback to HTTP
	return scrapeWithHTTP(ctx, req, timeout)
}

func scrapeWithPlaywright(ctx context.Context, req *types.ScrapeRequest, timeout int) (*types.ScrapeResponse, error) {
	resp := &types.ScrapeResponse{
		Success: false,
	}

	page, err := browser.NewPage(playwright.PageWaitForURLOptions{
		Timeout: playwright.Float(timeout),
	})
	if err != nil {
		resp.Error = fmt.Sprintf("create page error: %v", err)
		return resp, nil
	}
	defer page.Close()

	// Set headers if provided
	if req.Options != nil && req.Options.Headers != nil {
		// Note: Playwright doesn't support custom headers on initial request easily
		// This would require route interception
	}

	// Navigate to URL
	_, err = page.Goto(req.URL, playwright.PageGotoOptions{
		Timeout:   playwright.Float(timeout),
		WaitUntil: playwright.WaitUntilStateNetworkIdle,
	})
	if err != nil {
		resp.Error = fmt.Sprintf("navigate error: %v", err)
		return resp, nil
	}

	// Wait for specific selector if provided
	if req.Options != nil && req.Options.WaitFor != "" {
		page.WaitForSelector(req.Options.WaitFor, playwright.PageWaitForSelectorOptions{
			Timeout: playwright.Float(timeout),
		})
	}

	// Extract content based on formats
	data := &types.ScrapeData{
		Metadata: &types.Metadata{
			SourceURL: req.URL,
		},
	}

	for _, format := range req.Formats {
		switch strings.ToLower(format) {
		case "markdown", "text":
			content, err := page.Content()
			if err == nil {
				data.Markdown = convertHTMLToMarkdown(content)
			}
		case "html":
			content, err := page.Content()
			if err == nil {
				data.HTML = content
			}
		case "links":
			links, _ := page.Evaluate(`() => {
				return Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => h.startsWith('http'))
			}`)
			if links != nil {
				data.Links = links.([]string)
			}
		case "screenshot":
			screenshot, err := page.Screenshot()
			if err == nil {
				data.Screenshot = "data:image/png;base64," + base64Encode(screenshot)
			}
		}
	}

	// Get metadata
	title, _ := page.Title()
	data.Metadata.Title = title
	resp.Success = true
	resp.Data = data

	return resp, nil
}

func scrapeWithHTTP(ctx context.Context, req *types.ScrapeRequest, timeout int) (*types.ScrapeResponse, error) {
	resp := &types.ScrapeResponse{
		Success: false,
	}

	client := &http.Client{
		Timeout: time.Duration(timeout) * time.Millisecond,
	}

	httpReq, err := http.NewRequestWithContext(ctx, "GET", req.URL, nil)
	if err != nil {
		resp.Error = err.Error()
		return resp, nil
	}

	httpReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	res, err := client.Do(httpReq)
	if err != nil {
		resp.Error = err.Error()
		return resp, nil
	}
	defer res.Body.Close()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		resp.Error = err.Error()
		return resp, nil
	}

	data := &types.ScrapeData{
		Metadata: &types.Metadata{
			SourceURL:  req.URL,
			StatusCode: res.StatusCode,
		},
	}

	for _, format := range req.Formats {
		switch strings.ToLower(format) {
		case "markdown", "text", "html":
			data.Markdown = string(body)
			data.HTML = string(body)
		}
	}

	resp.Success = true
	resp.Data = data

	return resp, nil
}

// Helper functions
func convertHTMLToMarkdown(html string) string {
	// Simple HTML to markdown conversion
	// In production, use a proper library like github.com/JohannesKaufmann/html-to-markdown
	markdown := html
	markdown = strings.ReplaceAll(markdown, "<p>", "\n")
	markdown = strings.ReplaceAll(markdown, "</p>", "\n")
	markdown = strings.ReplaceAll(markdown, "<br>", "\n")
	markdown = strings.ReplaceAll(markdown, "<br/>", "\n")
	markdown = strings.ReplaceAll(markdown, "<h1>", "# ")
	markdown = strings.ReplaceAll(markdown, "</h1>", "\n")
	markdown = strings.ReplaceAll(markdown, "<h2>", "## ")
	markdown = strings.ReplaceAll(markdown, "</h2>", "\n")
	markdown = strings.ReplaceAll(markdown, "<h3>", "### ")
	markdown = strings.ReplaceAll(markdown, "</h3>", "\n")
	markdown = strings.ReplaceAll(markdown, "<li>", "- ")
	markdown = strings.ReplaceAll(markdown, "</li>", "\n")
	markdown = strings.ReplaceAll(markdown, "<a href=\"", "[")
	markdown = strings.ReplaceAll(markdown, "\">", "](")
	markdown = strings.ReplaceAll(markdown, "</a>", ")")
	// Remove remaining tags
	for strings.Contains(markdown, "<") {
		start := strings.Index(markdown, "<")
		end := strings.Index(markdown, ">")
		if end > start {
			markdown = markdown[:start] + markdown[end+1:]
		} else {
			break
		}
	}
	return strings.TrimSpace(markdown)
}

func base64Encode(data []byte) string {
	encoded := make([]byte, len(data)*2)
	base64.StdEncoding.Encode(encoded, data)
	return string(encoded)
}
