const express = require("express");
const { MessagingResponse } = require("twilio").twiml;
const nodemailer = require("nodemailer");
const CLIENT = require("./hairclub");

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Gmail transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "aitravelassistant1@gmail.com",
    pass: "kphh gabb ovdl mmky"
  }
});

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

async function sendLeadEmail(data) {
  const mailOptions = {
    from: "cameroncambay6@gmail.com",
    to: CLIENT.leadEmail,
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
  };

  await transporter.sendMail(mailOptions);
}

app.get("/", (req, res) => {
  res.send(`${CLIENT.businessName} bot is running`);
});

app.post("/whatsapp", async (req, res) => {
  const twiml = new MessagingResponse();
  let reply = "";

  try {
    const incomingMsg = String(req.body.Body || "").trim();
    const cleanMsg = incomingMsg.toLowerCase();
    const from = String(req.body.From || "unknown");

    if (!userState[from]) {
      resetUser(from);
    }

    console.log("FROM:", from);
    console.log("MSG:", incomingMsg);
    console.log("STEP BEFORE:", userState[from].step);

    // Always working commands
    if (
      cleanMsg === "hi" ||
      cleanMsg === "hello" ||
      cleanMsg === "menu" ||
      cleanMsg === "reset"
    ) {
      resetUser(from);
      reply = CLIENT.menuText;
    }

    // Appointment flow first
    else if (userState[from].step === "ask_name") {
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
      let selectedService = "";

      if (incomingMsg === "1") selectedService = "Haircut";
      else if (incomingMsg === "2") selectedService = "Beard Set";
      else if (incomingMsg === "3") selectedService = "Hair Spa";
      else if (incomingMsg === "4") selectedService = "Unisex Salon";
      else selectedService = incomingMsg;

      userState[from].service = selectedService;
      userState[from].step = "ask_time";
      reply = "Please send your preferred time.";
    } else if (userState[from].step === "ask_time") {
      userState[from].time = incomingMsg;

      try {
        await sendLeadEmail(userState[from]);

        reply =
          `Thank you! Your appointment request has been received.\n\n` +
          `Name: ${userState[from].name}\n` +
          `Phone: ${userState[from].phone}\n` +
          `Service: ${userState[from].service}\n` +
          `Preferred Time: ${userState[from].time}\n\n` +
          `Our team will contact you soon.`;
      } catch (emailError) {
        console.error("EMAIL ERROR:", emailError.message);
        reply =
          "Your appointment request was received, but email notification failed. Please try again.";
      }

      resetUser(from);
    }

    // Menu options after step flow
    else if (cleanMsg === "1") {
      reply = "Haircut price is ₹200.\n\nReply 5 to book appointment or type menu.";
    } else if (cleanMsg === "2") {
      reply = "Beard Set price is ₹150.\n\nReply 5 to book appointment or type menu.";
    } else if (cleanMsg === "3") {
      reply = "Hair Spa price is ₹1400.\n\nReply 5 to book appointment or type menu.";
    } else if (cleanMsg === "4") {
      reply = "Unisex Salon service is available.\n\nReply 5 to book appointment or type menu.";
    } else if (cleanMsg === "5") {
      userState[from].step = "ask_name";
      reply = "Please send your name.";
    } else if (cleanMsg === "6") {
      reply = `Our address is:\n${CLIENT.address}`;
    } else {
      reply = "Please type hi to see the menu.";
    }

    console.log("STEP AFTER:", userState[from]?.step);
    console.log("STATE:", userState[from]);
  } catch (error) {
    console.error("BOT ERROR:", error.message);
    reply = "Something went wrong. Please type hi to restart.";
  }

  twiml.message(reply);
  res.set("Content-Type", "text/xml");
  return res.status(200).send(twiml.toString());
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});