package session

import (
	"sync"
)

var (
	sessionStore = make(map[string]bool)
	mu           sync.Mutex
)

func DeleteSession(sessionId string) {
	mu.Lock()
	defer mu.Unlock()

	delete(sessionStore, sessionId)
}

func SetSession(sessionId string) {
	mu.Lock()
	defer mu.Unlock()

	sessionStore[sessionId] = true
}

func IsSessionSet(sessionId string) bool {
	mu.Lock()
	defer mu.Unlock()

	_, exists := sessionStore[sessionId]
	return exists
}
