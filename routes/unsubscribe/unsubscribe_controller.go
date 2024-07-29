package unsubscribe

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	dataAccess "github.com/webdevcody/go-mailing-list/data-access"
	"github.com/webdevcody/go-mailing-list/utils"

	_ "modernc.org/sqlite"
)

func RegisterUnsubscribe(app *fiber.App) {
	app.Get("/unsubscribe/:id", func(c *fiber.Ctx) error {
		id := c.Params("id")
		emailId, err := strconv.ParseInt(id, 10, 64)
		if err != nil {
			panic(err)
		}
		dataAccess.DeleteEmail(emailId)
		return c.Redirect("/unsubscribe-success")
	})

	app.Get("/unsubscribe-success", func(c *fiber.Ctx) error {
		return utils.Render(c, unsubscribed())
	})
}
