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
    const thread = await openai.beta.threads.create();
    threadId = thread.id;
    userThreads[chatId] = threadId;
  }

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
  } while (runStatus.status !== "completed");

  const messages = await openai.beta.threads.messages.list(threadId);
  const lastMessage = messages.data[0].content[0].text.value;

  await axios.post(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    { chat_id: chatId, text: lastMessage }
  );

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Saoirse bot server running on port ${PORT}`));