import TelegramBot from 'node-telegram-bot-api';

const TOKEN = process.env.BOT_TOKEN;

const bot = new TelegramBot(TOKEN, { 
    polling: true 
});

// Конфиг
const DAILY_FREE_SPINS = 3;
const SPIN_COST = 10;

// Хранилище пользователей
const users = new Map();

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

// Клавиатуры
const mainKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '🎡 КРУТИТЬ!', callback_data: 'spin' }],
            [{ text: '💰 Купить монеты', callback_data: 'buy_menu' }],
            [{ text: '📊 Профиль', callback_data: 'profile' }, { text: '🏆 Топ', callback_data: 'top' }]
        ]
    }
};

const buyKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '🪙 100 монет = 10⭐', callback_data: 'buy_10' }],
            [{ text: '🪙 600 монет = 50⭐', callback_data: 'buy_50' }],
            [{ text: '🪙 1500 монет = 100⭐', callback_data: 'buy_100' }],
            [{ text: '◀️ Назад', callback_data: 'back' }]
        ]
    }
};

const backKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '◀️ Назад', callback_data: 'back' }]
        ]
    }
};

async function showMenu(chatId, userId) {
    const user = getUser(userId, '');
    const text = `🎰 *SPINMASTER CASINO* 🎰\n\n` +
        `🪙 *${user.coins}* монет\n` +
        `🎲 Бесплатных вращений: *${user.spinsLeft}*\n` +
        `💎 Спин стоит: *${SPIN_COST}* монет\n\n` +
        `👇 Жми крутить!`;
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...mainKeyboard });
}

// Обработка команд
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;
    
    getUser(userId, username);
    showMenu(chatId, userId);
});

// Обработка callback запросов
bot.on('callback_query', async (callbackQuery) => {
    const action = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const messageId = callbackQuery.message.message_id;
    const username = callbackQuery.from.username || callbackQuery.from.first_name;
    
    const user = getUser(userId, username);
    
    if (action === 'spin') {
        let isFree = false;
        
        if (user.spinsLeft > 0) {
            isFree = true;
            user.spinsLeft--;
        } else if (user.coins >= SPIN_COST) {
            user.coins -= SPIN_COST;
        } else {
            bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Нет монет!', show_alert: true });
            return;
        }
        
        const prize = getRandomPrize();
        user.coins += prize.coins;
        user.totalSpins++;
        user.totalWon += prize.coins;
        
        bot.answerCallbackQuery(callbackQuery.id);
        
        const spinText = `🎡 *Крутим...* ${isFree ? '(бесплатно)' : `(-${SPIN_COST}🪙)`}`;
        bot.editMessageText(spinText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
        });
        
        setTimeout(() => {
            const resultText = `✨ *РЕЗУЛЬТАТ:* ✨\n\n${prize.name}!\n+${prize.coins} 🪙\n\n💰 Баланс: *${user.coins}* 🪙`;
            bot.editMessageText(resultText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                ...mainKeyboard
            });
        }, 1500);
        
        return;
    }
    
    if (action === 'buy_menu') {
        bot.editMessageText(
            `💎 *MAGAZINE* 💎\n\n` +
            `10⭐ → 100 🪙\n` +
            `50⭐ → 600 🪙 (+20%)\n` +
            `100⭐ → 1500 🪙 (+50%)\n\n` +
            `Платежи через Telegram Stars`,
            {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                ...buyKeyboard
            }
        );
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (action === 'profile') {
        const profileText = `👤 *ПРОФИЛЬ*\n\n` +
            `🪙 Монет: *${user.coins}*\n` +
            `🎡 Спинов: *${user.totalSpins}*\n` +
            `🏆 Выиграно: *${user.totalWon}* 🪙\n` +
            `🎲 Бесплатных: *${user.spinsLeft}* / день`;
        
        bot.editMessageText(profileText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            ...backKeyboard
        });
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (action === 'top') {
        const topUsers = Array.from(users.entries())
            .sort((a, b) => b[1].coins - a[1].coins)
            .slice(0, 10);
        
        let topText = `🏆 *ТОП ИГРОКОВ* 🏆\n\n`;
        topUsers.forEach(([id, data], index) => {
            topText += `${index + 1}. ${data.username || id} — ${data.coins} 🪙\n`;
        });
        
        if (topUsers.length === 0) topText += `Пока никого нет`;
        
        bot.editMessageText(topText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            ...backKeyboard
        });
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (action === 'back') {
        showMenu(chatId, userId);
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }
    
    if (action.startsWith('buy_')) {
        const stars = parseInt(action.split('_')[1]);
        let coins;
        if (stars === 10) coins = 100;
        else if (stars === 50) coins = 600;
        else if (stars === 100) coins = 1500;
        
        bot.answerCallbackQuery(callbackQuery.id, { text: `💫 Открываю платеж...` });
        
        // Invoice для Telegram Stars
        bot.sendInvoice(chatId, {
            title: `🪙 ${coins} монет`,
            description: `Пополнение баланса SpinMaster`,
            payload: JSON.stringify({ userId, coins, stars }),
            provider_token: '',
            currency: 'XTR',
            prices: [{ label: `${coins} монет`, amount: stars }],
            start_parameter: 'spinmaster_pay'
        });
        return;
    }
});

// Обработка успешной оплаты
bot.on('pre_checkout_query', (query) => {
    bot.answerPreCheckoutQuery(query.id, true);
});

bot.on('successful_payment', (msg) => {
    const payload = JSON.parse(msg.successful_payment.invoice_payload);
    const userId = payload.userId;
    const coins = payload.coins;
    
    const user = getUser(userId, '');
    user.coins += coins;
    
    bot.sendMessage(msg.chat.id, `✅ Оплачено!\n➕ +${coins} 🪙\n💰 Новый баланс: *${user.coins}* 🪙`, { parse_mode: 'Markdown' });
    showMenu(msg.chat.id, userId);
});

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.log('Polling error:', error.message);
});

console.log('🎰 Бот SpinMaster запущен!');