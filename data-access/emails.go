package dataAccess

import (
	"github.com/webdevcody/go-mailing-list/db"
)

type Email struct {
	Id    int64
	Email string
}

func CreateEmail(email string) (Email, error) {
	db := db.GetDB()
	stmt, err := db.Prepare("INSERT INTO emails (email) VALUES (?) RETURNING id, email")
	if err != nil {
		panic(err)
	}
	defer stmt.Close()

	var createdEmail Email
	err = stmt.QueryRow(email).Scan(&createdEmail.Id, &createdEmail.Email)
	if err != nil {
		return Email{}, err
	}

	return createdEmail, nil
}

func DeleteEmail(id int64) {
	db := db.GetDB()
	stmt, err := db.Prepare("DELETE FROM emails WHERE id = ?")
	if err != nil {
		panic(err)
	}
	_, err = stmt.Exec(id)
	if err != nil {
		panic(err)
	}
}

func GetEmails() []Email {
	db := db.GetDB()
	results, err := db.Query("SELECT * FROM emails")
	if err != nil {
		panic(err)
	}

	var emails []Email
	for results.Next() {
		var email Email
		if err := results.Scan(&email.Id, &email.Email); err != nil {
			panic(err)
		}
		emails = append(emails, email)
	}
	return emails
}
