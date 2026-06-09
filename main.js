const TelegramBot = require('node-telegram-bot-api');
const TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

// Хранилище
const users = new Map();
const DAILY_FREE_SPINS = 3;
const SPIN_COST = 10;

const PRIZES = [
    { name: '🎉 500 монет', coins: 500, chance: 0.05 },
    { name: '⭐ 100 монет', coins: 100, chance: 0.15 },
    { name: '🍀 50 монет', coins: 50, chance: 0.30 },
    { name: '😐 20 монет', coins: 20, chance: 0.30 },
    { name: '💎 ДЖЕКПОТ! 1000 монет', coins: 1000, chance: 0.03 },
    { name: '❌ 0 монет', coins: 0, chance: 0.17 }
];

function getRandomPrize() {
    const rand = Math.random();
    let accum = 0;
    for (const prize of PRIZES) {
        accum += prize.chance;
        if (rand < accum) return prize;
    }
    return PRIZES[0];
}

function getUser(userId, username) {
    if (!users.has(userId)) {
        users.set(userId, {
            coins: 100,
            spinsLeft: DAILY_FREE_SPINS,
            totalSpins: 0,
            totalWon: 0,
            username: username,
            lastSpinDate: null
        });
    }
    const user = users.get(userId);
    const today = new Date().toDateString();
    if (user.lastSpinDate !== today) {
        user.spinsLeft = DAILY_FREE_SPINS;
        user.lastSpinDate = today;
    }
    return user;
}

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;
    getUser(userId, username);
    
    bot.sendMessage(chatId, `🎰 Добро пожаловать в SpinMaster, ${username}!\nУ тебя 100 бонусных монет и 3 бесплатных вращения в день.`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🎡 КРУТИТЬ!', callback_data: 'spin' }],
                [{ text: '💰 Купить монеты', callback_data: 'buy' }],
                [{ text: '📊 Профиль', callback_data: 'profile' }]
            ]
        }
    });
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const username = query.from.username || query.from.first_name;
    const user = getUser(userId, username);
    
    if (query.data === 'spin') {
        let isFree = false;
        
        if (user.spinsLeft > 0) {
            isFree = true;
            user.spinsLeft--;
        } else if (user.coins >= SPIN_COST) {
            user.coins -= SPIN_COST;
        } else {
            bot.answerCallbackQuery(query.id, { text: '❌ Нет монет!', show_alert: true });
            return;
        }
        
        const prize = getRandomPrize();
        user.coins += prize.coins;
        user.totalSpins++;
        user.totalWon += prize.coins;
        
        bot.answerCallbackQuery(query.id);
        bot.sendMessage(chatId, `🎡 *Крутим...* ${isFree ? '(бесплатно)' : `(-${SPIN_COST}🪙)`}\n\n✨ *РЕЗУЛЬТАТ:* ${prize.name}!\n+${prize.coins} 🪙\n\n💰 *Баланс:* ${user.coins} 🪙`, { parse_mode: 'Markdown' });
        return;
    }
    
    if (query.data === 'profile') {
        bot.answerCallbackQuery(query.id);
        bot.sendMessage(chatId, `📊 *ПРОФИЛЬ*\n\n🪙 Монет: ${user.coins}\n🎡 Спинов: ${user.totalSpins}\n🏆 Выиграно: ${user.totalWon} 🪙\n🎲 Бесплатных сегодня: ${user.spinsLeft}`, { parse_mode: 'Markdown' });
        return;
    }
    
    if (query.data === 'buy') {
        bot.answerCallbackQuery(query.id);
        bot.sendMessage(chatId, `💎 *КУПИТЬ МОНЕТЫ*\n\n10⭐ = 100 🪙\n50⭐ = 600 🪙\n100⭐ = 1500 🪙\n\nПлатежи через Telegram Stars`, { parse_mode: 'Markdown' });
        return;
    }
});

bot.on('polling_error', (error) => {
    console.log('Polling error:', error.message);
});

console.log('✅ SpinMaster бот запущен');