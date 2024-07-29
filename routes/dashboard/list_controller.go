package dashboard

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/auth"
	dataAccess "github.com/webdevcody/go-mailing-list/data-access"
	"github.com/webdevcody/go-mailing-list/utils"

	_ "modernc.org/sqlite"
)

func registerListPanel(app *fiber.App) {
	app.Get("/dashboard/list", auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		emails := dataAccess.GetEmails()
		return utils.Render(c, emailList(auth.IsAuthenticated(c), emails))
	})

	app.Post("/actions/add-email", auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		formEmails := c.FormValue("emails")

		emails := strings.Split(formEmails, "\n")

		for _, email := range emails {
			err := dataAccess.CreateEmail(email)
			if err != nil {
				return c.Status(400).SendString("Could not add email - is it maybe a duplicate?")
			}
		}

		return c.Redirect("/dashboard/list")
	})

	app.Post("/actions/delete-email", auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		emailIdString := c.FormValue("id")
		emailId, err := strconv.ParseInt(emailIdString, 10, 64)
		if err != nil {
			panic(err)
		}
		dataAccess.DeleteEmail(emailId)
		return c.Redirect("/dashboard/list")
	})

}
