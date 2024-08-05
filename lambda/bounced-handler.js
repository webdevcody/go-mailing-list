export const handler = async (event) => {
  console.log(event);
  const email = event.bounce.bouncedRecipients[0].emailAddress;
  await fetch(`https://newsletter.wdcstarterkit.com/api/bounced`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.API_TOKEN}`,
    },
    body: JSON.stringify({ email }),
  });
};
