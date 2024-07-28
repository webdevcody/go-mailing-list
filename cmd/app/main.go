package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/migrations"
	"github.com/webdevcody/go-mailing-list/pages/dashboard"
)

func main() {
	log.Println("HTTP_LISTEN_ADDR: ", os.Getenv("HTTP_LISTEN_ADDR"))
	log.Println("DATABASE_URL: ", os.Getenv("DATABASE_URL"))

	migrations.RunMigrations()

	app := fiber.New()

	app.Static("/public", "./public")

	dashboard.RegisterDashboard(app)

	addr := os.Getenv("HTTP_LISTEN_ADDR")

	log.Fatal(app.Listen(addr))

}
