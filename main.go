package main

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/migrations"
	"github.com/webdevcody/go-mailing-list/pages/dashboard"
)

func main() {
	migrations.RunMigrations()

	app := fiber.New()

	app.Static("/public", "./public")

	dashboard.RegisterDashboard(app)

	log.Fatal(app.Listen(":3000"))

}
