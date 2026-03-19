require("dotenv").config();

const express = require("express");
const { Resend } = require("resend");

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const resend = new Resend(process.env.RESEND_API_KEY);

// ---------------- CLIENT CONFIG ----------------
const CLIENT = {
  id: "noorstyle",
  businessName: "Noor-E-Style Saloon",
  leadEmail: process.env.LEAD_EMAIL || "noorestyle0786@gmail.com",
  address: process.env.BUSINESS_ADDRESS || "Okhla, New Delhi",
  services: {
    "1": { name: "Advance Haircut", price: "₹500" },
    "2": { name: "Normal Haircut", price: "₹300" },
    "3": { name: "Head Wash", price: "₹200" },
    "4": { name: "Hair Spa", price: "₹1000" },
    "5": { name: "Hydra Facial", price: "₹3000" },
    "6": { name: "O3 Facial", price: "₹1500" },
    "7": { name: "Kanpeki Facial", price: "₹2500" },
    "8": { name: "Aroma Facial", price: "₹1500" },
    "9": { name: "Lotus Facial", price: "₹1000" },
    "10": { name: "Full Hand Wax", price: "₹250" },
    "11": { name: "Full Leg Wax", price: "₹500" },
    "12": { name: "Full Body Wax", price: "₹1500" },
    "13": { name: "Manicure", price: "₹400" },
    "14": { name: "Pedicure", price: "₹500" },
    "15": { name: "Party Makeup", price: "₹2500" },
    "16": { name: "Bridal Makeup", price: "₹10000" },
    "17": { name: "Nail Art", price: "₹1000" },
    "18": { name: "Hairstyle", price: "₹500" }
  }
};

const userState = {};

// ---------------- HELPERS ----------------
function resetUser(userKey) {
  userState[userKey] = {
    step: "menu",
    greeted: false,
    name: "",
    phone: "",
    service: "",
    time: ""
  };
}

function getWelcomeMessage() {
  let message =
    `👋 Hello! Welcome to ${CLIENT.businessName} ✨\n\n` +
    `Please choose an option:\n\n`;

  for (const key of Object.keys(CLIENT.services)) {
    const service = CLIENT.services[key];
    message += `${key}. ${service.name} — ${service.price}\n`;
  }

  message += `\n99. Book Appointment`;
  message += `\n00. Address`;

  return message;
}

function getServiceList() {
  let text = "Which service do you want?\n\n";

  for (const key of Object.keys(CLIENT.services)) {
    text += `${key}. ${CLIENT.services[key].name}\n`;
  }

  text += `\nSend service number.`;
  return text.trim();
}

function getServiceName(input) {
  const value = String(input || "").trim();
  if (CLIENT.services[value]) return CLIENT.services[value].name;
  return value;
}

function isMenuCommand(text) {
  const msg = String(text || "").toLowerCase().trim();
  return [
    "hi",
    "hii",
    "hiii",
    "hello",
    "helo",
    "hey",
    "hy",
    "hlo",
    "start",
    "menu",
    "reset",
    "restart"
  ].includes(msg);
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

// Flexible extractor because webhook field names may differ by setup.
function extractIncomingText(body) {
  return (
    body?.message ||
    body?.text ||
    body?.Body ||
    body?.content ||
    body?.msg ||
    body?.data?.message ||
    body?.data?.text ||
    body?.payload?.message ||
    body?.payload?.text ||
    ""
  );
}

function extractIncomingPhone(body) {
  return normalizePhone(
    body?.mobile ||
    body?.phone ||
    body?.from ||
    body?.sender ||
    body?.waNumber ||
    body?.BodyFrom ||
    body?.data?.mobile ||
    body?.data?.phone ||
    body?.data?.from ||
    body?.payload?.mobile ||
    body?.payload?.phone ||
    ""
  );
}

async function sendLeadEmail(data) {
  return await resend.emails.send({
    from: `${CLIENT.businessName} <onboarding@resend.dev>`,
    to: [CLIENT.leadEmail],
    subject: `New Appointment - ${CLIENT.businessName}`,
    text:
      `New Appointment Request\n\n` +
      `Name: ${data.name}\n` +
      `Phone: ${data.phone}\n` +
      `Service: ${data.service}\n` +
      `Preferred Time: ${data.time}\n\n` +
      `Business: ${CLIENT.businessName}\n` +
      `Address: ${CLIENT.address}\n` +
      `Source: AiSensy WhatsApp Bot`
  });
}

// Optional outbound sender via AiSensy API campaign.
// AiSensy docs show campaign sends through POST /campaign/t1/api/v2 with apiKey, campaignName,
// destination, userName, etc. :contentReference[oaicite:1]{index=1}
async function sendAiSensyMessage(destination, userName, templateParams = []) {
  const apiKey = process.env.AISENSY_API_KEY;
  const campaignName = process.env.AISENSY_CAMPAIGN_NAME;

  if (!apiKey || !campaignName) {
    console.log("AISENSY_API_KEY or AISENSY_CAMPAIGN_NAME missing, skipping outbound WhatsApp send.");
    return null;
  }

  const payload = {
    apiKey,
    campaignName,
    destination,
    userName: userName || "Customer",
    source: "Noor-E-Style Bot",
    templateParams
  };

  const response = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`AiSensy send failed: ${response.status} ${text}`);
  }

  return text;
}

// ---------------- ROUTES ----------------
app.get("/", (req, res) => {
  res.json({
    status: "Noor-E-Style AiSensy bot is running",
    business: CLIENT.businessName
  });
});

// Verification helper route if needed in platform settings
app.get("/webhook", (req, res) => {
  res.status(200).send("Webhook is live");
});

app.post("/webhook", async (req, res) => {
  let reply = "";

  try {
    console.log("RAW WEBHOOK:", JSON.stringify(req.body, null, 2));

    const incomingMsg = String(extractIncomingText(req.body) || "").trim();
    const cleanMsg = incomingMsg.toLowerCase().trim();
    const from = extractIncomingPhone(req.body);

    if (!from) {
      console.log("No user phone found in webhook payload.");
      return res.status(200).json({
        success: true,
        message: "Webhook received, but no phone number found"
      });
    }

    if (!userState[from]) {
      resetUser(from);
    }

    console.log("FROM:", from);
    console.log("MSG:", incomingMsg);
    console.log("STEP BEFORE:", userState[from].step);

    if (isMenuCommand(cleanMsg)) {
      resetUser(from);
      userState[from].greeted = true;
      reply = getWelcomeMessage();
    } else if (!userState[from].greeted && userState[from].step === "menu") {
      userState[from].greeted = true;
      reply = getWelcomeMessage();
    } else if (userState[from].step === "ask_name") {
      userState[from].name = incomingMsg;
      userState[from].step = "ask_phone";
      reply = "Please send your phone number.";
    } else if (userState[from].step === "ask_phone") {
      userState[from].phone = incomingMsg;
      userState[from].step = "ask_service";
      reply = getServiceList();
    } else if (userState[from].step === "ask_service") {
      userState[from].service = getServiceName(incomingMsg);
      userState[from].step = "ask_time";
      reply = "Please send your preferred time.";
    } else if (userState[from].step === "ask_time") {
      userState[from].time = incomingMsg;

      try {
        const emailResult = await sendLeadEmail(userState[from]);
        console.log("EMAIL SUCCESS:", emailResult);

        reply =
          `Thank you! Your appointment request has been received ✅\n\n` +
          `Name: ${userState[from].name}\n` +
          `Phone: ${userState[from].phone}\n` +
          `Service: ${userState[from].service}\n` +
          `Preferred Time: ${userState[from].time}\n\n` +
          `Our team will contact you soon.`;
      } catch (emailError) {
        console.error("EMAIL ERROR:", emailError.message);
        reply = "Your details have been received, but email notification failed.";
      }

      resetUser(from);
      userState[from].greeted = true;
    } else if (CLIENT.services[cleanMsg]) {
      const selectedService = CLIENT.services[cleanMsg];
      reply =
        `${selectedService.name} price is ${selectedService.price}.\n\n` +
        `Reply 99 to book appointment or type menu to see all options again.`;
    } else if (cleanMsg === "99") {
      userState[from].step = "ask_name";
      reply = "Great! Please send your name.";
    } else if (cleanMsg === "00") {
      reply = `Our address is:\n${CLIENT.address}`;
    } else {
      reply = getWelcomeMessage();
    }

    console.log("STEP AFTER:", userState[from]?.step);
    console.log("BOT REPLY:", reply);

    // Optional outbound message through AiSensy API campaign
    // For this to work, create a LIVE API campaign in AiSensy and set:
    // AISENSY_API_KEY, AISENSY_CAMPAIGN_NAME in .env
    //
    // Template should support one text variable, then reply goes in templateParams[0].
    //
    // If you do not want this now, just leave env vars blank.
    try {
      const sendResult = await sendAiSensyMessage(from, userState[from]?.name || "Customer", [reply]);
      console.log("AISENSY SEND RESULT:", sendResult);
    } catch (sendError) {
      console.error("AISENSY SEND ERROR:", sendError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Webhook processed"
    });
  } catch (error) {
    console.error("BOT ERROR:", error);
    return res.status(200).json({
      success: false,
      message: "Something went wrong"
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});