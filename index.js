const { VK } = require('vk-io');

// 👇 ТВОЙ ТОКЕН УЖЕ ВСТАВЛЕН 👇
const VK_TOKEN = 'vk1.a.BkvYuWVpqxBtIiRh8cdbu-LlzE1OaA3XfTgQ1g-c_2SofxwJBU2Mdo8QlnjvWYuZCCyP_TDxZBG8CYw_ucrHQDzDIrQkBOmHG7g2TocTjpG9esTnHIuzC7BUTHGQkzHB6t4_1TQ9ujvHRb-qvi11S4fRBCG0OEW4jwjDpSFchRrgo5aaYDrcItNCd-nbvBdhOHlX2ZK0wzBhfYer0nHMDQ';

const vk = new VK({ token: VK_TOKEN });

// Каталог товаров
const goods = [
  { id: 1, name: 'TG Premium 1 месяц', price: 299 },
  { id: 2, name: 'TG Аккаунт +50 подписчиков', price: 199 },
  { id: 3, name: 'TG Старый аккаунт 2020', price: 499 }
];

// Аккаунты (логин:пароль) — ЗАМЕНИ НА СВОИ
const accounts = {
  1: ['prem_user1:pass111', 'prem_user2:pass222'],
  2: ['fol50_1:folpass1', 'fol50_2:folpass2'],
  3: ['old2020_1:old123', 'old2020_2:old456']
};

let soldCount = { 1: 0, 2: 0, 3: 0 };
let users = new Map();

vk.updates.on('message_new', async (ctx) => {
  const userId = ctx.senderId;
  const text = ctx.text?.toLowerCase() || '';
  
  if (!users.has(userId)) {
    users.set(userId, { cart: [], purchases: [] });
  }
  const user = users.get(userId);
  
  // Старт
  if (text === 'start' || text === 'привет') {
    await ctx.send('🤖 Бот для продажи Telegram аккаунтов\n\nКоманды:\nкаталог\nкорзина\nоплатить\nпокупки');
    return;
  }
  
  // Каталог
  if (text === 'каталог') {
    let msg = '📋 Товары:\n\n';
    goods.forEach(g => {
      msg += `${g.id}. ${g.name} — ${g.price}₽\n`;
    });
    msg += '\nНапиши номер товара (1,2,3) чтобы добавить в корзину';
    await ctx.send(msg);
    return;
  }
  
  // Добавление в корзину
  if (text === '1' || text === '2' || text === '3') {
    const good = goods.find(g => g.id === parseInt(text));
    user.cart.push(good);
    users.set(userId, user);
    await ctx.send(`✅ ${good.name} добавлен в корзину`);
    return;
  }
  
  // Корзина
  if (text === 'корзина') {
    if (user.cart.length === 0) {
      await ctx.send('Корзина пуста');
      return;
    }
    let msg = '🛒 Корзина:\n';
    let total = 0;
    user.cart.forEach((g, i) => {
      msg += `${i+1}. ${g.name} — ${g.price}₽\n`;
      total += g.price;
    });
    msg += `\nИтого: ${total}₽\nНапиши "оплатить"`;
    await ctx.send(msg);
    return;
  }
  
  // Оплата
  if (text === 'оплатить') {
    if (user.cart.length === 0) {
      await ctx.send('Корзина пуста');
      return;
    }
    
    let result = '🎉 Твои покупки:\n\n';
    for (const good of user.cart) {
      const accs = accounts[good.id];
      const idx = soldCount[good.id];
      
      if (idx < accs.length) {
        const [login, pass] = accs[idx].split(':');
        soldCount[good.id]++;
        user.purchases.push({ name: good.name, login, pass, date: Date.now() });
        result += `✅ ${good.name}\n🔑 ${login}:${pass}\n\n`;
      } else {
        result += `❌ ${good.name} — закончился\n\n`;
      }
    }
    user.cart = [];
    users.set(userId, user);
    await ctx.send(result);
    return;
  }
  
  // История покупок
  if (text === 'покупки') {
    if (user.purchases.length === 0) {
      await ctx.send('Нет покупок');
      return;
    }
    let msg = '📜 История:\n\n';
    user.purchases.forEach((p, i) => {
      msg += `${i+1}. ${p.name}\n🔑 ${p.login}:${p.pass}\n\n`;
    });
    await ctx.send(msg);
    return;
  }
  
  await ctx.send('❓ Не понял. Напиши "каталог"');
});

vk.updates.start().then(() => console.log('✅ Бот запущен'));