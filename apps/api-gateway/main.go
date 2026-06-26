package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	app := fiber.New(fiber.Config{
		AppName: "OpenPDF API Gateway v1.0",
	})

	// Middleware
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
	}))

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"service": "api-gateway",
			"version": "1.0.0",
		})
	})

	// API routes
	api := app.Group("/api/v1")
	
	api.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "OpenPDF API",
			"version": "1.0.0",
		})
	})

	// Documents routes
	documents := api.Group("/documents")
	documents.Get("/", listDocuments)
	documents.Post("/", createDocument)
	documents.Get("/:id", getDocument)
	documents.Put("/:id", updateDocument)
	documents.Delete("/:id", deleteDocument)

	// Export routes
	export := api.Group("/export")
	export.Post("/pdf", exportPDF)
	export.Post("/svg", exportSVG)
	export.Post("/png", exportPNG)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	
	log.Printf("API Gateway starting on port %s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatal(err)
	}
}

// Document handlers (stub implementations)
func listDocuments(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"documents": []fiber.Map{},
		"total":     0,
	})
}

func createDocument(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"id":      "doc-123",
		"message": "Document created",
	})
}

func getDocument(c *fiber.Ctx) error {
	id := c.Params("id")
	return c.JSON(fiber.Map{
		"id":   id,
		"name": "Untitled Document",
	})
}

func updateDocument(c *fiber.Ctx) error {
	id := c.Params("id")
	return c.JSON(fiber.Map{
		"id":      id,
		"message": "Document updated",
	})
}

func deleteDocument(c *fiber.Ctx) error {
	id := c.Params("id")
	return c.JSON(fiber.Map{
		"id":      id,
		"message": "Document deleted",
	})
}

// Export handlers (stub implementations)
func exportPDF(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"url":      "/downloads/export.pdf",
		"filename": "document.pdf",
		"size":     0,
	})
}

func exportSVG(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"url":      "/downloads/export.svg",
		"filename": "document.svg",
		"size":     0,
	})
}

func exportPNG(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"url":      "/downloads/export.png",
		"filename": "document.png",
		"size":     0,
	})
}
