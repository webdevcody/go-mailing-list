package logout

import (
	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/auth"

	_ "modernc.org/sqlite"
)

func RegisterLogout(app *fiber.App) {
	app.Get("/logout", func(c *fiber.Ctx) error {
		auth.ClearSession(c)
		return c.Redirect("/login")
	})
}
