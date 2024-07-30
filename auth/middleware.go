package auth

import (
	"crypto/rand"
	"encoding/hex"
	"os"

	"github.com/gofiber/fiber/v2"
)

var sessionStore = make(map[string]bool) // Simulated session store

func AssertAuthenticatedMiddleware(c *fiber.Ctx) error {
	if !IsAuthenticated(c) {
		return c.Redirect("/login")
	}
	return c.Next()
}

func IsAuthenticated(c *fiber.Ctx) bool {
	userSessionId := GetUserSessionId(c)
	_, exists := sessionStore[userSessionId]
	return userSessionId != "" && exists
}

func GetUserSessionId(c *fiber.Ctx) string {
	return c.Cookies("session")
}

func SetSession(c *fiber.Ctx) {
	newSessionId := generateSessionId()
	sessionStore[newSessionId] = true
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
	delete(sessionStore, userSessionId)
	c.Cookie(&fiber.Cookie{
		Name:     "session",
		Value:    "",
		HTTPOnly: true,
		Secure:   true,
		SameSite: "Strict",
	})
}

func generateSessionId() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		panic(err)
	}
	return hex.EncodeToString(bytes)
}

func IsValidPassword(password string) bool {
	return password == os.Getenv("PASSWORD")
}
