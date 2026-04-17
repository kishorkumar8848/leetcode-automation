const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const http = require("http");   // ← ADD THIS

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
bot.deleteWebHook();
bot.startPolling();

let userCode = {};
let userProblem = {};

async function getProblem() {
    try {
        const res = await axios.post(
            'https://leetcode.com/graphql',
            {
                query: `query { randomQuestion(categorySlug: "", filters: {}) { title titleSlug difficulty } }`
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0",
                    "Referer": "https://leetcode.com/problemset/"
                }
            }
        );
        return res.data.data.randomQuestion;
    } catch (error) {
        console.error("ERROR:", error.response?.data || error.message);
        return null;
    }
}

async function generateCode(problemTitle) {
    try {
        const res = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "openai/gpt-3.5-turbo",
                messages: [
                    {
                        role: "user",
                        content: `Return ONLY Java code in LeetCode format. No explanation. No comments. problem: ${problemTitle}.`
                    }
                ]
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        let output = res.data.choices[0].message.content;
        output = output.replace(/```java/g, "").replace(/```/g, "").trim();
        return output;

    } catch (err) {
        console.error("AI Error:", err.response?.data || err.message);
        return "❌ AI failed.";
    }
}

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
`🚀 LeetCode AI Bot Ready!

Commands:
/problem - Get problem + AI code
/submit - Show code + link
/help - Help menu`);
});

bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
`📌 Commands:
/problem - Get problem + AI code
/submit - Show submission link`);
});

bot.onText(/\/problem/, async (msg) => {
    const chatId = msg.chat.id;
    const q = await getProblem();
    if (!q) { bot.sendMessage(chatId, "❌ Error fetching problem."); return; }

    const code = await generateCode(q.title);
    const url = `https://leetcode.com/problems/${q.titleSlug}`;

    // Save for /submit
    userCode[chatId] = code;
    userProblem[chatId] = q;

    bot.sendMessage(chatId, code, {
        reply_markup: {
            inline_keyboard: [[{ text: "Solve in your account 🚀", url }]]
        }
    });
});

bot.onText(/\/submit/, (msg) => {
    const chatId = msg.chat.id;
    const code = userCode[chatId];
    const problem = userProblem[chatId];

    if (!problem) { bot.sendMessage(chatId, "❌ No problem found. Use /problem first."); return; }
    if (!code) { bot.sendMessage(chatId, "❌ No code found."); return; }

    const url = `https://leetcode.com/problems/${problem.titleSlug}`;
    bot.sendMessage(chatId,
`🚀 Ready to submit!

📌 Problem: ${problem.title}

👉 Open: ${url}

💻 Your Code:
${code.slice(0, 3000)}`);
});

// ✅ Dummy HTTP server so Render doesn't kill the process
http.createServer((req, res) => res.end("Bot is running!")).listen(process.env.PORT || 3000, () => {
    console.log("HTTP server running - keeping Render alive");
});