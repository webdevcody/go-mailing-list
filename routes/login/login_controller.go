package login

import (
	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/auth"
	"github.com/webdevcody/go-mailing-list/utils"

	_ "github.com/mattn/go-sqlite3"
)

func RegisterLogin(app *fiber.App) {
	app.Get("/login", func(c *fiber.Ctx) error {
		if auth.IsAuthenticated(c) {
			return c.Redirect("/dashboard")
		}
		return utils.Render(c, login(auth.IsAuthenticated(c)))
	})

	app.Post("/actions/login", func(c *fiber.Ctx) error {
		password := c.FormValue("password")
		isValid := auth.IsValidPassword(password)
		if !isValid {
			return c.Redirect("/login")
		}
		auth.SetSession(c)
		c.Response().Header.Set("HX-Redirect", "/dashboard/list")
		return c.SendStatus(fiber.StatusNoContent)
	})

}
