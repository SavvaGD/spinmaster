import { Telegraf } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply('🎰 Бот работает! Пишем полную версию...');
});

// Vercel handler для main.js
export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(200).json({ ok: false });
    }
  } else {
    res.status(200).json({ status: 'alive' });
  }
}