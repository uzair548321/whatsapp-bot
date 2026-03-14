const express = require("express");
const { MessagingResponse } = require("twilio").twiml;
const CLIENT = require("./hairclub");

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

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

app.get("/", (req, res) => {
  res.send(`${CLIENT.businessName} bot is running`);
});

app.post("/whatsapp", (req, res) => {
  const twiml = new MessagingResponse();
  let reply = "";

  const incomingMsg = String(req.body.Body || "").trim();
  const cleanMsg = incomingMsg.toLowerCase();
  const from = String(req.body.From || "unknown");

  console.log("MSG:", incomingMsg);
  console.log("FROM:", from);

  if (!userState[from]) {
    resetUser(from);
  }

  if (
    cleanMsg === "hi" ||
    cleanMsg === "hello" ||
    cleanMsg === "menu" ||
    cleanMsg === "reset"
  ) {
    resetUser(from);
    reply = CLIENT.menuText;
  } else if (cleanMsg === "1") {
    reply = "Haircut price is ₹200.\n\nReply 5 to book appointment or type menu.";
  } else if (cleanMsg === "2") {
    reply = "Beard Set price is ₹150.\n\nReply 5 to book appointment or type menu.";
  } else if (cleanMsg === "3") {
    reply = "Hair Spa price is ₹1400.\n\nReply 5 to book appointment or type menu.";
  } else if (cleanMsg === "4") {
    reply = "Unisex Salon service is available.\n\nReply 5 to book appointment or type menu.";
  } else if (cleanMsg === "6") {
    reply = `Our address is:\n${CLIENT.address}`;
  } else if (cleanMsg === "5") {
    userState[from].step = "ask_name";
    reply = "Please send your name.";
  } else if (userState[from].step === "ask_name") {
    userState[from].name = incomingMsg;
    userState[from].step = "ask_phone";
    reply = "Please send your phone number.";
  } else if (userState[from].step === "ask_phone") {
    userState[from].phone = incomingMsg;
    userState[from].step = "ask_service";
    reply = "Which service do you want?\n1 Haircut\n2 Beard Set\n3 Hair Spa\n4 Unisex Salon";
  } else if (userState[from].step === "ask_service") {
    let selectedService = incomingMsg;

    if (incomingMsg === "1") selectedService = "Haircut";
    if (incomingMsg === "2") selectedService = "Beard Set";
    if (incomingMsg === "3") selectedService = "Hair Spa";
    if (incomingMsg === "4") selectedService = "Unisex Salon";

    userState[from].service = selectedService;
    userState[from].step = "ask_time";
    reply = "Please send your preferred time.";
  } else if (userState[from].step === "ask_time") {
    userState[from].time = incomingMsg;

    reply =
      `Thank you! Your appointment request has been received.\n\n` +
      `Name: ${userState[from].name}\n` +
      `Phone: ${userState[from].phone}\n` +
      `Service: ${userState[from].service}\n` +
      `Preferred Time: ${userState[from].time}\n\n` +
      `Our team will contact you soon.`;

    resetUser(from);
  } else {
    reply = "Please type hi to see the menu.";
  }

  twiml.message(reply);
  res.set("Content-Type", "text/xml");
  return res.status(200).send(twiml.toString());
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});