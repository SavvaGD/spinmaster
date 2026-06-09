import { Telegraf, Markup } from 'telegraf';
import { kv } from '@vercel/kv';

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

// Конфиг
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

async function getUser(userId, username) {
  let user = await kv.hgetall(`user:${userId}`);
  if (!user) {
    user = {
      coins: 100,
      spinsLeft: DAILY_FREE_SPINS,
      totalSpins: 0,
      totalWon: 0,
      username: username,
      lastSpinDate: null
    };
    await kv.hset(`user:${userId}`, user);
  }
  
  const today = new Date().toDateString();
  if (user.lastSpinDate !== today) {
    user.spinsLeft = DAILY_FREE_SPINS;
    user.lastSpinDate = today;
    await kv.hset(`user:${userId}`, user);
  }
  
  return user;
}

async function showMenu(ctx, userId) {
  const user = await getUser(userId, ctx.from.username || ctx.from.first_name);
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🎡 КРУТИТЬ!', `spin_${userId}`)],
    [Markup.button.callback('💰 Купить монеты', 'buy_menu')],
    [Markup.button.callback('📊 Профиль', 'profile'), Markup.button.callback('🏆 Топ', 'top')]
  ]);
  
  const text = `🎰 *SPINMASTER CASINO* 🎰\n\n` +
    `🪙 *${user.coins}* монет\n` +
    `🎲 Бесплатных вращений: *${user.spinsLeft}*\n` +
    `💎 Спин стоит: *${SPIN_COST}* монет\n\n` +
    `👇 Жми крутить и забирай джекпот!`;
  
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard });
    await ctx.answerCbQuery();
  } else {
    await ctx.replyWithMarkdown(text, keyboard);
  }
}

// Команда /start
bot.start(async (ctx) => {
  await showMenu(ctx, ctx.from.id);
});

bot.action(/spin_(\d+)/, async (ctx) => {
  const userId = parseInt(ctx.match[1]);
  if (userId !== ctx.from.id) {
    return ctx.answerCbQuery('Чужое колесо!');
  }
  
  let user = await getUser(userId, ctx.from.username);
  let isFree = false;
  
  if (user.spinsLeft > 0) {
    isFree = true;
    user.spinsLeft--;
  } else if (user.coins >= SPIN_COST) {
    user.coins -= SPIN_COST;
  } else {
    await ctx.answerCbQuery('❌ Нет монет! Купи за Stars →', true);
    return;
  }
  
  const prize = getRandomPrize();
  user.coins += prize.coins;
  user.totalSpins++;
  user.totalWon += prize.coins;
  await kv.hset(`user:${userId}`, user);
  
  await ctx.answerCbQuery();
  
  const msg = await ctx.replyWithMarkdown(
    `🎡 *Крутим...* ${isFree ? '(бесплатно)' : `(-${SPIN_COST}🪙)`}`
  );
  
  setTimeout(async () => {
    await ctx.telegram.editMessageText(
      ctx.chat.id, msg.message_id, null,
      `✨ *РЕЗУЛЬТАТ:* ✨\n\n${prize.name}!\n+${prize.coins} 🪙\n\n` +
      `💰 Баланс: *${user.coins}* 🪙`
    );
    setTimeout(() => showMenu(ctx, userId), 2000);
  }, 1500);
});

bot.action('buy_menu', async (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🪙 100 монет = 10⭐', 'buy_10')],
    [Markup.button.callback('🪙 600 монет = 50⭐', 'buy_50')],
    [Markup.button.callback('🪙 1500 монет = 100⭐', 'buy_100')],
    [Markup.button.callback('◀️ Назад', 'back')]
  ]);
  
  await ctx.editMessageText(
    `💎 *MAGAZINE* 💎\n\n` +
    `Выбери пакет монет:\n\n` +
    `10⭐ → 100 🪙\n` +
    `50⭐ → 600 🪙 (+20%)\n` +
    `100⭐ → 1500 🪙 (+50%)\n\n` +
    `🔒 Платежи через Telegram Stars\n` +
    `💳 Карта НЕ передается боту`,
    { parse_mode: 'Markdown', ...keyboard }
  );
  await ctx.answerCbQuery();
});

bot.action(/buy_(\d+)/, async (ctx) => {
  const stars = parseInt(ctx.match[1]);
  let coins;
  if (stars === 10) coins = 100;
  else if (stars === 50) coins = 600;
  else if (stars === 100) coins = 1500;
  else return ctx.answerCbQuery('Ошибка');
  
  try {
    await ctx.replyWithInvoice({
      title: `🪙 ${coins} монет`,
      description: `Пополнение игрового баланса SpinMaster`,
      payload: JSON.stringify({ userId: ctx.from.id, coins, stars }),
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: `${coins} монет`, amount: stars }],
      start_parameter: 'spinmaster_pay'
    });
    await ctx.answerCbQuery('💫 Открываю платеж...');
  } catch (err) {
    console.error(err);
    await ctx.answerCbQuery('❌ Ошибка, попробуй позже');
  }
});

bot.on('pre_checkout_query', async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on('successful_payment', async (ctx) => {
  const payment = ctx.message.successful_payment;
  const { userId, coins } = JSON.parse(payment.invoice_payload);
  
  const user = await kv.hgetall(`user:${userId}`);
  if (user) {
    user.coins += coins;
    await kv.hset(`user:${userId}`, user);
  }
  
  await ctx.replyWithMarkdown(
    `✅ *Оплачено!*\n\n` +
    `➕ +${coins} 🪙\n` +
    `💰 Новый баланс: *${user?.coins || coins}* 🪙\n\n` +
    `Спасибо за донат! 🎉`
  );
  
  await showMenu(ctx, userId);
});

bot.action('profile', async (ctx) => {
  const user = await getUser(ctx.from.id, ctx.from.username);
  const keyboard = Markup.inlineKeyboard([Markup.button.callback('◀️ Назад', 'back')]);
  
  await ctx.editMessageText(
    `👤 *ПРОФИЛЬ*\n\n` +
    `ID: \`${ctx.from.id}\`\n` +
    `🪙 Монет: *${user.coins}*\n` +
    `🎡 Спинов: *${user.totalSpins || 0}*\n` +
    `🏆 Выиграно: *${user.totalWon || 0}* 🪙\n` +
    `🎲 Бесплатных: *${user.spinsLeft}* / день`,
    { parse_mode: 'Markdown', ...keyboard }
  );
  await ctx.answerCbQuery();
});

bot.action('top', async (ctx) => {
  const keyboard = Markup.inlineKeyboard([Markup.button.callback('◀️ Назад', 'back')]);
  await ctx.editMessageText(
    `🏆 *ТОП ИГРОКОВ* 🏆\n\n` +
    `Скоро здесь будет таблица лидеров!\n\n` +
    `Чтобы попасть в топ — крути колесо и копи монеты!`,
    { parse_mode: 'Markdown', ...keyboard }
  );
  await ctx.answerCbQuery();
});

bot.action('back', async (ctx) => {
  await showMenu(ctx, ctx.from.id);
});

// Vercel serverless handler
export default async function handler(req, res) {
  // Устанавливаем заголовки для Telegram
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('Handler error:', err);
      res.status(200).json({ ok: false, error: err.message });
    }
  } else {
    res.status(200).json({ status: 'alive', bot: 'SpinMaster' });
  }
}