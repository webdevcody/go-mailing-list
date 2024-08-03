package list

import (
	"strconv"
	"strings"

	"github.com/a-h/templ"
	"github.com/go-playground/validator"
	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/auth"
	dataAccess "github.com/webdevcody/go-mailing-list/data-access"
	"github.com/webdevcody/go-mailing-list/utils"

	_ "github.com/mattn/go-sqlite3"
)

func EmailListPage() templ.Component {
	emails := dataAccess.GetEmails()
	return emailListPanel(true, emails)
}

func RegisterListPanel(app *fiber.App) {
	app.Get("/dashboard/list", auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		return utils.Render(c, EmailListPage())
	})

	app.Post("/actions/add-email", auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		formEmails := c.FormValue("emails")
		validate := validator.New()

		emails := strings.Split(formEmails, "\n")

		validEmails := make([]string, 0)

		hadInvalidEmails := false

		// loop over each email and validate it, if it's valid add it another lisce
		for _, email := range emails {
			errs := validate.Var(email, "required,email")
			if errs != nil {
				hadInvalidEmails = true
			} else {
				validEmails = append(validEmails, email)
			}
		}

		createdEmails := make([]dataAccess.Email, 0)

		for _, email := range validEmails {
			newEmail, err := dataAccess.CreateEmail(email)
			if err == nil {
				createdEmails = append(createdEmails, newEmail)
			}
		}

		if hadInvalidEmails {
			return utils.Render(c, withInvalidEmails(emailList(createdEmails)))
		} else {
			return utils.Render(c, emailList(createdEmails))
		}
	})

	app.Post("/actions/delete-email", auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		emailIdString := c.FormValue("id")
		emailId, err := strconv.ParseInt(emailIdString, 10, 64)
		if err != nil {
			panic(err)
		}
		dataAccess.DeleteEmail(emailId)
		return c.SendStatus(fiber.StatusOK)
	})

}
