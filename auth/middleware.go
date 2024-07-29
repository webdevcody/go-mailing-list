package auth

import (
	"os"

	"github.com/gofiber/fiber/v2"
)

var activeSessionId = ""

func AssertAuthenticatedMiddleware(c *fiber.Ctx) error {
	if !IsAuthenticated(c) {
		return c.Redirect("/login")
	}
	return c.Next()
}

func IsAuthenticated(c *fiber.Ctx) bool {
	return GetUserSessionId(c) == activeSessionId
}

func GetUserSessionId(c *fiber.Ctx) string {
	return c.Cookies("session")
}

func SetSession(c *fiber.Ctx, newSessionId string) {
	activeSessionId = newSessionId
	c.Cookie(&fiber.Cookie{
		Name:  "session",
		Value: newSessionId,
	})
}

func ClearSession(c *fiber.Ctx) {
	activeSessionId = ""
	c.ClearCookie("session")
}

func IsValidPassword(password string) bool {
	return password == os.Getenv("PASSWORD")
}
