package migrations

import (
	"github.com/webdevcody/go-mailing-list/db"
)

func RunMigrations() {
	db := db.GetDB()
	stmt, err := db.Prepare("CREATE TABLE IF NOT EXISTS emails (id INTEGER PRIMARY KEY, email TEXT)")
	if err != nil {
		panic(err)
	}
	stmt.Exec()
}
