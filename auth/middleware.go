package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/auth/session"
)

const sessionIdLength = 32

func AssertAuthenticatedMiddleware(c *fiber.Ctx) error {
	if !IsAuthenticated(c) {
		c.Response().Header.Set("HX-Redirect", "/login")
		return c.Redirect("/login")
	}
	return c.Next()
}

func IsAuthenticated(c *fiber.Ctx) bool {
	userSessionId := GetUserSessionId(c)
	sessionExists := session.IsSessionSet(userSessionId)
	return sessionExists
}

func GetUserSessionId(c *fiber.Ctx) string {
	return c.Cookies("session")
}

func SetSession(c *fiber.Ctx) {
	newSessionId := generateSessionId()
	session.SetSession(newSessionId)
	c.Cookie(&fiber.Cookie{
		Name:     "session",
		Value:    newSessionId,
		HTTPOnly: true,
		Secure:   true,
		SameSite: "Strict",
	})
}

func ClearSession(c *fiber.Ctx) {
	userSessionId := GetUserSessionId(c)
	session.DeleteSession(userSessionId)
	c.Cookie(&fiber.Cookie{
		Name:     "session",
		Value:    "",
		HTTPOnly: true,
		Secure:   true,
		SameSite: "Strict",
	})
}

func generateSessionId() string {
	bytes := make([]byte, sessionIdLength)
	if _, err := rand.Read(bytes); err != nil {
		panic(err)
	}
	return hex.EncodeToString(bytes)
}

func IsValidPassword(password string) bool {
	expectedPassword := os.Getenv("PASSWORD")
	return subtle.ConstantTimeCompare([]byte(password), []byte(expectedPassword)) == 1
}
