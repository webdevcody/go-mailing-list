package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/migrations"
	"github.com/webdevcody/go-mailing-list/routes"
)

func main() {
	migrations.RunMigrations()

	app := fiber.New(fiber.Config{
		Network: fiber.NetworkTCP,
	})

	app.Static("/public", "./public")

	routes.RegisterRoutes(app)

	addr := os.Getenv("HTTP_LISTEN_ADDR")

	log.Fatal(app.Listen(addr))
}
