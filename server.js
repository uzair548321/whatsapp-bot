const express = require("express");
const axios = require("axios");
const { MessagingResponse } = require("twilio").twiml;

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const userState = {};

app.get("/", (req, res) => {
  res.send("WhatsApp Bot is Running 🚀");
});

app.post("/whatsapp", async (req, res) => {
  const twiml = new MessagingResponse();
  let reply = "";

  try {
    const incomingMsg = String(req.body.Body || "").trim();
    const cleanMsg = incomingMsg.toLowerCase();
    const from = String(req.body.From || "unknown");

    console.log("BODY:", req.body);
    console.log("MSG:", incomingMsg);
    console.log("FROM:", from);

    if (!userState[from]) {
      userState[from] = { step: "menu" };
    }

    if (cleanMsg === "hi" || cleanMsg === "hello") {
      userState[from] = { step: "menu" };
      reply =
        "Hello 👋 Welcome!\n\n" +
        "1️⃣ Services\n" +
        "2️⃣ Pricing\n" +
        "3️⃣ Book Demo";
    } else if (cleanMsg === "1") {
      reply =
        "We provide:\n\n" +
        "• AI Chatbots\n" +
        "• WhatsApp Automation\n" +
        "• AI Voice Agents";
    } else if (cleanMsg === "2") {
      reply =
        "Our pricing depends on your needs.\n\n" +
        "Please tell us about your business.";
    } else if (cleanMsg === "3") {
      userState[from].step = "ask_name";
      reply = "Great! Please send your Name.";
    } else if (userState[from].step === "ask_name") {
      userState[from].name = incomingMsg;
      userState[from].step = "ask_business";
      reply = "Please send your Business Name.";
    } else if (userState[from].step === "ask_business") {
      userState[from].businessName = incomingMsg;
      userState[from].step = "ask_phone";
      reply = "Please send your Phone Number.";
    } else if (userState[from].step === "ask_phone") {
      userState[from].phone = incomingMsg;
      userState[from].step = "ask_requirement";
      reply = "Please send your Requirement.";
    } else if (userState[from].step === "ask_requirement") {
      userState[from].requirement = incomingMsg;

      await axios.post(
        "https://elevateaisystems6.app.n8n.cloud/webhook/whatsapp-lead",
        {
          name: userState[from].name || "",
          businessName: userState[from].businessName || "",
          phone: userState[from].phone || "",
          message: userState[from].requirement || "",
          source: "WhatsApp Bot",
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 15000,
        }
      );

      reply =
        "✅ Thanks! Your details have been saved.\n\n" +
        "Our team will contact you soon.";

      userState[from] = { step: "menu" };
    } else {
      reply =
        "Please reply with:\n\n" +
        "1️⃣ Services\n" +
        "2️⃣ Pricing\n" +
        "3️⃣ Book Demo";
    }
  } catch (error) {
    console.error("FULL ERROR:", error.message);
    console.error("ERROR DATA:", error.response?.data);
    reply = "Something went wrong. Please try again.";
  }

  twiml.message(reply);
  res.writeHead(200, { "Content-Type": "text/xml" });
  res.end(twiml.toString());
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});