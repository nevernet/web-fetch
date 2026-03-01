package handler

import (
	"context"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/hertz/pkg/protocol/consts"
	"github.com/nevernet/web-fetch/pkg/scraper"
	"github.com/nevernet/web-fetch/pkg/types"
)

// Register registers all routes
func Register(h *server.Hertz) {
	h.GET("/health", Health)
	h.POST("/scrape", Scrape)
	h.POST("/crawl", Crawl)
}

// Health handles health check
func Health(ctx context.Context, c *app.RequestContext) {
	c.JSON(consts.StatusOK, types.HealthResponse{
		Status:     "ok",
		Playwright: scraper.IsInitialized(),
	})
}

// Scrape handles scrape requests
func Scrape(ctx context.Context, c *app.RequestContext) {
	var req types.ScrapeRequest
	if err := c.Bind(&req); err != nil {
		c.JSON(consts.StatusBadRequest, types.ScrapeResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	resp, err := scraper.Scrape(ctx, &req)
	if err != nil {
		c.JSON(consts.StatusInternalServerError, types.ScrapeResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(consts.StatusOK, resp)
}

// Crawl handles crawl requests (simplified version)
func Crawl(ctx context.Context, c *app.RequestContext) {
	var req types.CrawlRequest
	if err := c.Bind(&req); err != nil {
		c.JSON(consts.StatusBadRequest, types.CrawlResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	// Simplified: just scrape the URL for now
	scrapeReq := &types.ScrapeRequest{
		URL:     req.URL,
		Formats: []string{"markdown"},
	}

	resp, err := scraper.Scrape(ctx, scrapeReq)
	if err != nil {
		c.JSON(consts.StatusInternalServerError, types.CrawlResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(consts.StatusOK, types.CrawlResponse{
		Success: resp.Success,
		Data: &types.CrawlData{
			Pages: []types.PageResult{
				{
					URL:      req.URL,
					Markdown: resp.Data.Markdown,
					Status:   200,
				},
			},
			Stats: &types.CrawlStats{
				TotalURLs:   1,
				SuccessURLs: 1,
			},
		},
	})
}
