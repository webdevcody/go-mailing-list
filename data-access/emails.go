package dataAccess

import (
	"github.com/webdevcody/go-mailing-list/db"
)

type Email struct {
	Id            int64
	Email         string
	UnsubscribeId string
}

func CreateEmail(email string) (Email, error) {
	db := db.GetDB()
	stmt, err := db.Prepare("INSERT INTO emails (email, unsubscribeId) VALUES (?, lower(hex(randomblob(32)))) RETURNING id, email")
	if err != nil {
		panic(err)
	}
	defer stmt.Close()

	var createdEmail Email
	err = stmt.QueryRow(email).Scan(&createdEmail.Id, &createdEmail.Email, &createdEmail.UnsubscribeId)
	if err != nil {
		return Email{}, err
	}

	return createdEmail, nil
}

func DeleteEmailByEmail(email string) error {
	db := db.GetDB()
	stmt, err := db.Prepare("DELETE FROM emails WHERE email = ?")
	if err != nil {
		return err
	}
	_, err = stmt.Exec(email)
	if err != nil {
		return err
	}
	return nil
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
		if err := results.Scan(&email.Id, &email.Email, &email.UnsubscribeId); err != nil {
			panic(err)
		}
		emails = append(emails, email)
	}
	return emails
}

func DeleteEmailByUnsubscribeId(unsubscribeId string) error {
	db := db.GetDB()
	stmt, err := db.Prepare("DELETE FROM emails WHERE unsubscribeId = ?")
	if err != nil {
		return err
	}
	_, err = stmt.Exec(unsubscribeId)
	if err != nil {
		return err
	}
	return nil
}
