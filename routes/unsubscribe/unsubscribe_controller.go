package unsubscribe

import (
	"github.com/gofiber/fiber/v2"
	dataAccess "github.com/webdevcody/go-mailing-list/data-access"
	"github.com/webdevcody/go-mailing-list/utils"

	_ "github.com/mattn/go-sqlite3"
)

func RegisterUnsubscribe(app *fiber.App) {
	app.Get("/unsubscribe/:id", func(c *fiber.Ctx) error {
		unsubscribeId := c.Params("id")
		dataAccess.DeleteEmailByUnsubscribeId(unsubscribeId)
		return c.Redirect("/unsubscribe-success")
	})

	app.Get("/unsubscribe-success", func(c *fiber.Ctx) error {
		return utils.Render(c, unsubscribed())
	})
}
