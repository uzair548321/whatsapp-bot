require("dotenv").config();

const express = require("express");
const { Resend } = require("resend");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const resend = new Resend(process.env.RESEND_API_KEY);

// ---------- CLIENT DATA ----------
const CLIENT = {
  businessName: "Noor-E-Style Saloon",
  leadEmail: process.env.LEAD_EMAIL,
  address: process.env.BUSINESS_ADDRESS,
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

// ---------- HELPERS ----------
function resetUser(user) {
  userState[user] = {
    step: "menu",
    name: "",
    phone: "",
    service: "",
    time: ""
  };
}

function getMenu() {
  let msg = `👋 Welcome to ${CLIENT.businessName} ✨\n\n`;

  for (let key in CLIENT.services) {
    msg += `${key}. ${CLIENT.services[key].name} — ${CLIENT.services[key].price}\n`;
  }

  msg += `\n99. Book Appointment`;
  msg += `\n00. Address`;

  return msg;
}

async function sendEmail(data) {
  await resend.emails.send({
    from: `${CLIENT.businessName} <onboarding@resend.dev>`,
    to: [CLIENT.leadEmail],
    subject: "New Appointment",
    text: `
Name: ${data.name}
Phone: ${data.phone}
Service: ${data.service}
Time: ${data.time}
`
  });
}

// ---------- ROUTES ----------
app.get("/", (req, res) => {
  res.send("Bot running");
});

app.get("/webhook", (req, res) => {
  res.send("Webhook is live");
});

// TEST EMAIL
app.get("/test-email", async (req, res) => {
  try {
    await resend.emails.send({
      from: "Test <onboarding@resend.dev>",
      to: [CLIENT.leadEmail],
      subject: "Test Email",
      text: "Bot working"
    });

    res.send("Email sent");
  } catch (e) {
    res.send("Error: " + e.message);
  }
});

// MAIN WEBHOOK
app.post("/webhook", async (req, res) => {
  console.log("RAW:", req.body);

  const msg =
    req.body.message ||
    req.body.text ||
    req.body.data?.message ||
    "";

  const from =
    req.body.mobile ||
    req.body.phone ||
    req.body.data?.mobile ||
    "user";

  if (!userState[from]) resetUser(from);

  let reply = "";

  if (
    ["hi", "hello", "hii", "hey", "menu"].includes(msg.toLowerCase())
  ) {
    resetUser(from);
    reply = getMenu();
  }

  else if (msg === "99") {
    userState[from].step = "name";
    reply = "Enter your name";
  }

  else if (userState[from].step === "name") {
    userState[from].name = msg;
    userState[from].step = "phone";
    reply = "Enter phone number";
  }

  else if (userState[from].step === "phone") {
    userState[from].phone = msg;
    userState[from].step = "service";
    reply = getMenu();
  }

  else if (userState[from].step === "service") {
    userState[from].service =
      CLIENT.services[msg]?.name || msg;
    userState[from].step = "time";
    reply = "Enter preferred time";
  }

  else if (userState[from].step === "time") {
    userState[from].time = msg;

    await sendEmail(userState[from]);

    reply = "✅ Appointment booked! We will contact you.";

    resetUser(from);
  }

  else if (msg === "00") {
    reply = CLIENT.address;
  }

  else if (CLIENT.services[msg]) {
    reply =
      CLIENT.services[msg].name +
      " price: " +
      CLIENT.services[msg].price +
      "\nReply 99 to book";
  }

  else {
    reply = getMenu();
  }

  console.log("REPLY:", reply);

  res.json({
    success: true,
    reply: reply
  });
});

// ---------- START ----------
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});