app.post("/whatsapp", (req, res) => {
  console.log("==== TEST WEBHOOK HIT ====");
  console.log("BODY:", req.body);

  const twiml = new MessagingResponse();
  twiml.message("Bot reply test successful");

  res.set("Content-Type", "text/xml");
  return res.status(200).send(twiml.toString());
});