const express = require("express");
const axios = require("axios");
const { MessagingResponse } = require("twilio").twiml;

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

/**
 * =========================
 * CLIENT CONFIG
 * Har client ke liye bas yeh object change karo
 * =========================
 */
const CLIENT_CONFIG = {
  companyName: "Elevate AI Systems",
  welcomeMessage: "Hello 👋 Welcome!",
  servicesText:
    "We provide:\n\n• AI Chatbots\n• WhatsApp Automation\n• AI Voice Agents",
  pricingText:
    "Our pricing depends on your needs.\n\nPlease tell us about your business.",
  demoStartText: "Great! Please send your Name.",
  savedText:
    "✅ Thanks! Your details have been saved.\n\nOur team will contact you soon.",
  fallbackText:
    "Please reply with:\n\n1️⃣ Services\n2️⃣ Pricing\n3️⃣ Book Demo",
  source: "WhatsApp Bot",
  webhookUrl: "https://elevateaisystems6.app.n8n.cloud/webhook/whatsapp-lead",
};

const userState = {};

/**
 * Helpers
 */
function getMenuText() {
  return (
    `${CLIENT_CONFIG.welcomeMessage}\n\n` +
    `1️⃣ Services\n` +
    `2️⃣ Pricing\n` +
    `3️⃣ Book Demo`
  );
}

function resetUser(from) {
  userState[from] = {
    step: "menu",
    name: "",
    businessName: "",
    phone: "",
    requirement: "",
  };
}

async function sendLeadToN8n(data) {
  return axios.post(
    CLIENT_CONFIG.webhookUrl,
    {
      name: data.name || "",
      businessName: data.businessName || "",
      phone: data.phone || "",
      message: data.requirement || "",
      source: CLIENT_CONFIG.source,
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    }
  );
}

/**
 * Health route
 */
app.get("/", (req, res) => {
  res.send(`${CLIENT_CONFIG.companyName} WhatsApp Bot is Running 🚀`);
});

/**
 * WhatsApp webhook
 */
app.post("/whatsapp", async (req, res) => {
  const twiml = new MessagingResponse();
  let reply = "";

  const incomingMsg = String(req.body.Body || "").trim();
  const cleanMsg = incomingMsg.toLowerCase();
  const from = String(req.body.From || "unknown");

  try {
    console.log("BODY:", req.body);
    console.log("MSG:", incomingMsg);
    console.log("FROM:", from);

    if (!userState[from]) {
      resetUser(from);
    }

    // ALWAYS WORKING COMMANDS
    if (
      cleanMsg === "hi" ||
      cleanMsg === "hello" ||
      cleanMsg === "menu" ||
      cleanMsg === "reset"
    ) {
      resetUser(from);
      reply = getMenuText();
    } else if (cleanMsg === "1") {
      reply = CLIENT_CONFIG.servicesText;
    } else if (cleanMsg === "2") {
      reply = CLIENT_CONFIG.pricingText;
    } else if (cleanMsg === "3") {
      userState[from].step = "ask_name";
      reply = CLIENT_CONFIG.demoStartText;
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

      try {
        await sendLeadToN8n(userState[from]);
        reply = CLIENT_CONFIG.savedText;
      } catch (webhookError) {
        console.error(
          "N8N ERROR:",
          webhookError.response?.data || webhookError.message
        );
        // user atakna nahi chahiye
        reply =
          "⚠️ Your details were received, but saving failed once.\nPlease type *hi* and try again, or our team will contact you.";
      }

      resetUser(from);
    } else {
      reply = CLIENT_CONFIG.fallbackText;
    }
  } catch (error) {
    console.error("BOT ERROR:", error.response?.data || error.message);
    resetUser(from);
    reply = "Something went wrong. Please type *hi* to restart the menu.";
  }

  twiml.message(reply);
  res.writeHead(200, { "Content-Type": "text/xml" });
  res.end(twiml.toString());
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});