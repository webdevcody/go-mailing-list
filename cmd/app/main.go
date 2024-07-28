package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/migrations"
	"github.com/webdevcody/go-mailing-list/pages/dashboard"
)

func main() {
	migrations.RunMigrations()

	app := fiber.New()

	app.Static("/public", "./public")

	dashboard.RegisterDashboard(app)

	addr := os.Getenv("HTTP_LISTEN_ADDR")

	log.Fatal(app.Listen(addr))

}
