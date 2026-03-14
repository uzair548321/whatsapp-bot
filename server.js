const express = require("express");
const { MessagingResponse } = require("twilio").twiml;

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

/* Root route */
app.get("/", (req, res) => {
  res.send("BOT VERSION TEST 14 MAR");
});

/* WhatsApp webhook */
app.post("/whatsapp", (req, res) => {
  console.log("==== TEST WEBHOOK HIT ====");
  console.log("BODY:", req.body);

  const twiml = new MessagingResponse();
  twiml.message("Bot reply test successful");

  res.set("Content-Type", "text/xml");
  res.status(200).send(twiml.toString());
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});