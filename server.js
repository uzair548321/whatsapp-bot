require("dotenv").config();

const express = require("express");
const axios = require("axios");
const { MessagingResponse } = require("twilio").twiml;
const { Resend } = require("resend");
const CLIENT = require("./hairclub");

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const resend = new Resend(process.env.RESEND_API_KEY);

const userState = {};

function resetUser(from) {
  userState[from] = {
    step: "menu",
    name: "",
    phone: "",
    service: "",
    time: ""
  };
}

function isGreeting(text) {
  const msg = String(text || "").toLowerCase().trim();
  return ["hi", "hii", "hiii", "hello", "helo", "hey", "hy", "start", "menu", "reset"].includes(msg);
}

function getWelcomeMessage() {
  return (
    `Hello! Welcome to ${CLIENT.businessName} ✨\n\n` +
    `How can we help you today?\n\n` +
    `1️⃣ Haircut — ₹200\n` +
    `2️⃣ Beard Set — ₹150\n` +
    `3️⃣ Hair Spa — ₹1400\n` +
    `4️⃣ Unisex Salon\n` +
    `5️⃣ Book Appointment\n` +
    `6️⃣ Address`
  );
}

function getServiceName(input) {
  const value = String(input || "").trim();
  if (CLIENT.services[value]) return CLIENT.services[value].name;
  return value;
}

async function saveLeadToGoogleSheet(data) {
  if (!process.env.GOOGLE_SCRIPT_URL) {
    throw new Error("GOOGLE_SCRIPT_URL missing in .env");
  }

  const response = await axios.post(
    process.env.GOOGLE_SCRIPT_URL,
    {
      name: data.name,
      phone: data.phone,
      service: data.service,
      time: data.time,
      source: "WhatsApp Bot"
    },
    {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 15000
    }
  );

  return response.data;
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
      `Source: WhatsApp Bot`
  });
}

app.get("/", (req, res) => {
  res.send(`${CLIENT.businessName} bot is running`);
});

app.post("/whatsapp", async (req, res) => {
  const twiml = new MessagingResponse();
  let reply = "";

  try {
    const incomingMsg = String(req.body.Body || "").trim();
    const cleanMsg = incomingMsg.toLowerCase().trim();
    const from = String(req.body.From || "unknown");

    if (!userState[from]) {
      resetUser(from);
    }

    console.log("FROM:", from);
    console.log("MSG:", incomingMsg);
    console.log("STEP BEFORE:", userState[from].step);

    if (isGreeting(cleanMsg)) {
      resetUser(from);
      reply = getWelcomeMessage();
    } else if (userState[from].step === "ask_name") {
      userState[from].name = incomingMsg;
      userState[from].step = "ask_phone";
      reply = "Please send your phone number.";
    } else if (userState[from].step === "ask_phone") {
      userState[from].phone = incomingMsg;
      userState[from].step = "ask_service";
      reply =
        "Which service do you want?\n" +
        "1 Haircut\n" +
        "2 Beard Set\n" +
        "3 Hair Spa\n" +
        "4 Unisex Salon";
    } else if (userState[from].step === "ask_service") {
      userState[from].service = getServiceName(incomingMsg);
      userState[from].step = "ask_time";
      reply = "Please send your preferred time.";
    } else if (userState[from].step === "ask_time") {
      userState[from].time = incomingMsg;

      let sheetSaved = false;
      let emailSent = false;

      try {
        const sheetResult = await saveLeadToGoogleSheet(userState[from]);
        sheetSaved = true;
        console.log("GOOGLE SHEET SUCCESS:", sheetResult);
      } catch (sheetError) {
        console.error("GOOGLE SHEET ERROR:", sheetError.response?.data || sheetError.message);
      }

      try {
        const emailResult = await sendLeadEmail(userState[from]);
        emailSent = true;
        console.log("EMAIL SUCCESS:", emailResult);
      } catch (emailError) {
        console.error("EMAIL ERROR:", emailError.response?.data || emailError.message);
      }

      reply =
        `Thank you! Your appointment request has been received ✅\n\n` +
        `Name: ${userState[from].name}\n` +
        `Phone: ${userState[from].phone}\n` +
        `Service: ${userState[from].service}\n` +
        `Preferred Time: ${userState[from].time}\n\n` +
        `Our team will contact you soon.`;

      if (!sheetSaved && !emailSent) {
        reply = `Your details have been received, but notification setup is incomplete.`;
      }

      resetUser(from);
    } else if (cleanMsg === "1") {
      reply = "Haircut price is ₹200.\n\nReply 5 to book appointment or type hi for menu.";
    } else if (cleanMsg === "2") {
      reply = "Beard Set price is ₹150.\n\nReply 5 to book appointment or type hi for menu.";
    } else if (cleanMsg === "3") {
      reply = "Hair Spa price is ₹1400.\n\nReply 5 to book appointment or type hi for menu.";
    } else if (cleanMsg === "4") {
      reply = "Unisex Salon service is available.\n\nReply 5 to book appointment or type hi for menu.";
    } else if (cleanMsg === "5") {
      userState[from].step = "ask_name";
      reply = "Great! Please send your name.";
    } else if (cleanMsg === "6") {
      reply = `Our address is:\n${CLIENT.address}`;
    } else {
      reply = "Hello! Please type hi to see the menu.";
    }

    console.log("STEP AFTER:", userState[from]?.step);
  } catch (error) {
    console.error("BOT ERROR:", error);
    reply = "Something went wrong. Please type hi to restart.";
  }

  twiml.message(reply);
  res.set("Content-Type", "text/xml");
  return res.status(200).send(twiml.toString());
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});