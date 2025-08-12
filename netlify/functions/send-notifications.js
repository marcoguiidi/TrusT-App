const { Expo } = require("expo-server-sdk");

const expo = new Expo();

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  const body = JSON.parse(event.body);
  const { to, title, message, data } = body;

  if (!to || !title || !message) {
    return {
      statusCode: 400,
      body: "Missing required parameters: to, title, message",
    };
  }

  if (!Expo.isExpoPushToken(to)) {
    return {
      statusCode: 400,
      body: `Invalid Expo push token: ${to}`,
    };
  }

  const messages = [
    {
      to: to,
      sound: "default",
      title: title,
      body: message,
      data: data,
    },
  ];

  try {
    let ticket = await expo.sendPushNotificationsAsync(messages);
    console.log("Notifica inviata con successo:", ticket);
    return {
      statusCode: 200,
      body: JSON.stringify({ ticket }),
    };
  } catch (error) {
    console.error("Errore nell'invio della notifica:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
