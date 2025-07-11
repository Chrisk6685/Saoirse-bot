import express from "express";
import axios from "axios";
import OpenAI from "openai";

const app = express();
app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const userThreads = {};

app.post("/telegram", async (req, res) => {
  const message = req.body.message;
  if (!message || !message.text) return res.sendStatus(200);

  const chatId = message.chat.id;
  const userMessage = message.text;

  let threadId = userThreads[chatId];
  if (!threadId) {
    try {
      const thread = await openai.beta.threads.create();
      console.log("Created new thread response:", JSON.stringify(thread, null, 2));
      if (!thread || !thread.id) {
        console.error("Thread creation returned invalid response:", thread);
        return res.sendStatus(500); // Fail gracefully
      }
      threadId = thread.id;
      userThreads[chatId] = threadId;
    } catch (error) {
      console.error("Error creating thread:", error);
      return res.sendStatus(500); // Fail gracefully
    }
  }

  try {
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: userMessage,
    });

    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: "asst_AIb6g1seiMMXOSchyZtydoR3",
    });

    let runStatus;
    do {
      await new Promise((r) => setTimeout(r, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      console.log(`Run status: ${runStatus.status}`);
    } while (runStatus.status !== "completed");

    const messages = await openai.beta.threads.messages.list(threadId);
    const lastMessage = messages.data[0].content[0].text.value;

    console.log(`Sending response to Telegram: ${lastMessage}`);

    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      { chat_id: chatId, text: lastMessage }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error("Error processing message:", error);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Saoirse bot server running on port ${PORT}`));
