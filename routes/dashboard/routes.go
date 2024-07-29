package dashboard

import (
	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/auth"
)

func RegisterDashboard(app *fiber.App) {
	app.Get("/dashboard", auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		return c.Redirect("/dashboard/list")
	})
	registerListPanel(app)
	registerMailerPanel(app)
}
