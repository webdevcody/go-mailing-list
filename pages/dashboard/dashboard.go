package dashboard

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	dataAccess "github.com/webdevcody/go-mailing-list/data-access"
	"github.com/webdevcody/go-mailing-list/utils"

	_ "modernc.org/sqlite"
)

func RegisterDashboard(app *fiber.App) {
	app.Get("/dashboard", func(c *fiber.Ctx) error {
		emails := dataAccess.GetEmails()

		return utils.Render(c, dashboard(emails))
	})

	app.Post("/actions/add-email", func(c *fiber.Ctx) error {
		formEmails := c.FormValue("emails")

		emails := strings.Split(formEmails, "\n")

		for _, email := range emails {
			dataAccess.CreateEmail(email)
		}

		return c.Redirect("/dashboard")
	})

	app.Post("/actions/delete-email", func(c *fiber.Ctx) error {
		emailIdString := c.FormValue("id")
		emailId, err := strconv.ParseInt(emailIdString, 10, 64)
		if err != nil {
			panic(err)
		}
		dataAccess.DeleteEmail(emailId)
		return c.Redirect("/dashboard")
	})
}
