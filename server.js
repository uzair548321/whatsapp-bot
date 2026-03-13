const express = require("express");
const { MessagingResponse } = require("twilio").twiml;

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("WhatsApp bot is live ✅");
});

app.post("/whatsapp", (req, res) => {
  const incomingMsg = (req.body.Body || "").trim().toLowerCase();
  const twiml = new MessagingResponse();

  let reply = "";

  if (incomingMsg === "hi" || incomingMsg === "hello") {
    reply = "Hello 👋 Welcome!\n\n1. Services\n2. Pricing\n3. Book Demo";
  } else if (incomingMsg === "1") {
    reply = "We provide:\n- AI Chatbots\n- WhatsApp Automation\n- Voice Agents";
  } else if (incomingMsg === "2") {
    reply = "Our pricing depends on your needs.\nPlease share your business type.";
  } else if (incomingMsg === "3") {
    reply = "Great! Please send:\nName:\nBusiness Name:\nPhone:\nRequirement:";
  } else {
    reply = "Thanks! Our team will contact you soon.";
  }

  twiml.message(reply);
  res.writeHead(200, { "Content-Type": "text/xml" });
  res.end(twiml.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});