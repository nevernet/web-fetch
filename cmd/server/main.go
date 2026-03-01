package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cloudwego/hertz/pkg/app/server"
	"github.com/nevernet/web-fetch/internal/handler"
	"github.com/nevernet/web-fetch/pkg/scraper"
)

func main() {
	// Initialize scraper
	ctx := context.Background()
	if err := scraper.Init(ctx); err != nil {
		log.Printf("Warning: Playwright init failed: %v, will use HTTP fallback", err)
	}
	defer scraper.Close(ctx)

	// Start Hertz server
	h := server.Default(
		server.WithHostPort("0.0.0.0:8080"),
		server.WithReadTimeout(60*time.Second),
		server.WithWriteTimeout(60*time.Second),
	)

	// Register routes
	handler.Register(h)

	// Graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan
		log.Println("Shutting down server...")
		h.Shutdown(context.Background())
	}()

	log.Println("Web-Fetch server starting on :8080")
	h.Spin()
}
