// =======================
// 1. IMPORTS
// =======================
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// =======================
// 2. CONFIG
// =======================
const BOT_TOKEN = "8456180566:AAGWfnW64O-mImdRNd4auzVpJZXY-sRafbU";
const GEMINI_API_KEY = "AIzaSyBjITyAYlR7sM9lostqzCcTEO8weR0D7go";

// =======================
// 3. INIT BOT
// =======================
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// =======================
// 4. STORAGE
// =======================
let userCode = {};
let userProblem = {};

// =======================
// 5. FETCH RANDOM PROBLEM
// =======================
async function getProblem() {
    try {
        const res = await axios.post(
            'https://leetcode.com/graphql',
            {
                query: `
                query {
                  randomQuestion(categorySlug: "", filters: {}) {
                    title
                    titleSlug
                    difficulty
                  }
                }
                `
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

// =======================
// 6. GENERATE CODE (AI)
// =======================
async function generateCode(problemTitle) {
    try {
        const res = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "openai/gpt-3.5-turbo",
                messages: [
                    {
                        role: "user",
                        content: `Return ONLY Java code in LeetCode format .No explanation. No comments. problem: ${problemTitle}. No explanation.`
                    }
                ]
            },
            {
                headers: {
                    "Authorization": "Bearer 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",
                    "Content-Type": "application/json"
                }
            }
        );

        let output = res.data.choices[0].message.content;

        // clean markdown
        output = output.replace(/```python/g, "").replace(/```/g, "");

        return output;

    } catch (err) {
        console.error("AI Error:", err.response?.data || err.message);
        return "❌ AI failed.";
    }
}
// =======================
// 7. COMMANDS
// =======================

// START
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
`🚀 LeetCode AI Bot Ready!

Commands:
/problem - Get problem + AI code
/submit - Show code + link
/help - Help menu`
    );
});

// HELP
bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
`📌 Commands:
/problem - Get problem + AI code
/submit - Show submission link`
    );
});

// PROBLEM + AI CODE
bot.onText(/\/problem/, async (msg) => {
    const chatId = msg.chat.id;

    const q = await getProblem();
    if (!q) {
        bot.sendMessage(chatId, "Error");
        return;
    }

    const code = await generateCode(q.title);

    const url = `https://leetcode.com/problems/${q.titleSlug}`;

    // ✅ Send ONLY code + button
    bot.sendMessage(
        chatId,
        code,
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "Solve in your account 🚀",
                            url: url
                        }
                    ]
                ]
            }
        }
    );
});
// SUBMIT
bot.onText(/\/submit/, (msg) => {
    const chatId = msg.chat.id;

    const code = userCode[chatId];
    const problem = userProblem[chatId];

    if (!problem) {
        bot.sendMessage(chatId, "❌ No problem found. Use /problem first.");
        return;
    }

    if (!code) {
        bot.sendMessage(chatId, "❌ No code found.");
        return;
    }

    const url = `https://leetcode.com/problems/${problem.titleSlug}`;

    bot.sendMessage(
        chatId,
`🚀 Ready to submit!

📌 Problem: ${problem.title}

👉 Open:
${url}

💻 Your Code:
${code.slice(0, 3000)}`
    );
});