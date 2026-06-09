const TelegramBot = require('node-telegram-bot-api');

const TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

// Команда /start
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, '🤖 Бот работает!');
});

// Эхо (бот отвечает тем же сообщением)
bot.on('message', (msg) => {
    const text = msg.text;
    if (!text || text.startsWith('/')) return;
    bot.sendMessage(msg.chat.id, `Вы сказали: ${text}`);
});

console.log('✅ Бот запущен');
console.log('молюсь чтоб запустилось');