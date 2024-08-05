export const handler = async (event) => {
  const records = event.Records;

  for (const record of records) {
    const snsEvent = record.Sns;
    const message = JSON.parse(snsEvent.Message);
    const email = message.bounce.bouncedRecipients[0].emailAddress;
    const params = new URLSearchParams();
    params.append("email", email);
    await fetch(`https://newsletter.wdcstarterkit.com/api/bounced`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
  }
};
