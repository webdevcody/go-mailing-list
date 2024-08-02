package bounced

import (
	"strings"

	"github.com/go-playground/validator"
	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/auth"
	dataAccess "github.com/webdevcody/go-mailing-list/data-access"
	"github.com/webdevcody/go-mailing-list/utils"

	_ "github.com/mattn/go-sqlite3"
)

func RegisterBouncedPanel(app *fiber.App) {
	app.Get("/dashboard/bounced", auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		return utils.Render(c, BouncedPanel(true))
	})

	app.Post("/actions/delete-emails", auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		formEmails := c.FormValue("emails")
		validate := validator.New()

		emails := strings.Split(formEmails, "\n")

		validEmails := make([]string, 0)

		// loop over each email and validate it, if it's valid add it another lisce
		for _, email := range emails {
			errs := validate.Var(email, "required,email")
			if errs == nil {
				validEmails = append(validEmails, email)
			}
		}

		for _, email := range validEmails {
			_ = dataAccess.DeleteEmailByEmail(email)
		}

		return c.SendStatus(fiber.StatusOK)
	})

}
