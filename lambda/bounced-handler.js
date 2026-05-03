export const handler = async (event) => {
  const records = event.Records;

  for (const record of records) {
    const snsEvent = record.Sns;
    const message = JSON.parse(snsEvent.Message);
    const bounce = message.bounce;

    for (const recipient of bounce.bouncedRecipients) {
      const params = new URLSearchParams();
      params.append("email", recipient.emailAddress);
      params.append("reason", bounce.bounceSubType || bounce.bounceType || "Bounce");
      await fetch(process.env.BOUNCED_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.API_TOKEN}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
    }
  }
};
