const express = require('express');
const { VK } = require('vk-io');
const Database = require('better-sqlite3');

const app = express();
app.use(express.json());

// Подключение БД
const db = new Database('shop.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS goods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, price INTEGER, description TEXT
  );
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    good_id INTEGER, login TEXT, password TEXT, is_sold INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS users (
    vk_id INTEGER PRIMARY KEY,
    cart TEXT DEFAULT '[]',
    purchases TEXT DEFAULT '[]'
  );
`);

// Добавляем товары если их нет
const goodsCount = db.prepare('SELECT COUNT(*) as count FROM goods').get();
if (goodsCount.count === 0) {
  db.exec(`
    INSERT INTO goods (name, price, description) VALUES 
    ('TG Premium 1 мес', 299, 'Premium на 30 дней'),
    ('TG Аккаунт +50 подписчиков', 199, '50 реальных подписчиков');
  `);
}

const vk = new VK({ token: process.env.VK_TOKEN });

// Обработка сообщений
vk.updates.on('message_new', async (ctx) => {
  const vkId = ctx.senderId;
  if (!vkId) return;
  
  // Регистрация пользователя
  db.prepare('INSERT OR IGNORE INTO users (vk_id) VALUES (?)').run(vkId);
  
  const text = ctx.text?.toLowerCase() || '';
  
  // Каталог
  if (text === 'start' || text === 'привет' || text === 'каталог') {
    const goods = db.prepare('SELECT * FROM goods').all();
    let message = '📋 Наш каталог:\n\n';
    goods.forEach(g => {
      message += `${g.id}. ${g.name} — ${g.price}₽\n   ${g.description}\n\n`;
    });
    message += 'Напишите номер товара, чтобы добавить в корзину';
    await ctx.send(message);
  }
  
  // Добавление в корзину (по номеру)
  else if (/^\d+$/.test(text)) {
    const goodId = parseInt(text);
    const good = db.prepare('SELECT * FROM goods WHERE id = ?').get(goodId);
    
    if (good) {
      const user = db.prepare('SELECT cart FROM users WHERE vk_id = ?').get(vkId);
      const cart = JSON.parse(user.cart);
      cart.push(good);
      db.prepare('UPDATE users SET cart = ? WHERE vk_id = ?').run(JSON.stringify(cart), vkId);
      await ctx.send(`✅ ${good.name} добавлен в корзину!\n\nНапишите "корзина" для оформления`);
    } else {
      await ctx.send('❌ Товар не найден. Напишите "каталог" для просмотра');
    }
  }
  
  // Просмотр корзины
  else if (text === 'корзина') {
    const user = db.prepare('SELECT cart FROM users WHERE vk_id = ?').get(vkId);
    const cart = JSON.parse(user.cart);
    
    if (cart.length === 0) {
      await ctx.send('🛒 Корзина пуста. Напишите "каталог" для покупок');
      return;
    }
    
    let message = '📦 Ваша корзина:\n';
    let total = 0;
    cart.forEach((g, i) => {
      message += `${i+1}. ${g.name} — ${g.price}₽\n`;
      total += g.price;
    });
    message += `\n💰 Итого: ${total}₽\n\nНапишите "оплатить" для оформления`;
    await ctx.send(message);
  }
  
  // Оформление заказа
  else if (text === 'оплатить') {
    const user = db.prepare('SELECT cart FROM users WHERE vk_id = ?').get(vkId);
    const cart = JSON.parse(user.cart);
    
    if (cart.length === 0) {
      await ctx.send('Корзина пуста');
      return;
    }
    
    let result = '🎉 Ваши покупки:\n\n';
    let allSuccess = true;
    
    for (const good of cart) {
      const account = db.prepare(`
        SELECT * FROM accounts WHERE good_id = ? AND is_sold = 0 LIMIT 1
      `).get(good.id);
      
      if (account) {
        db.prepare('UPDATE accounts SET is_sold = 1 WHERE id = ?').run(account.id);
        
        // Сохраняем покупку
        const userPurchases = db.prepare('SELECT purchases FROM users WHERE vk_id = ?').get(vkId);
        const purchases = JSON.parse(userPurchases.purchases);
        purchases.push({
          good_id: good.id,
          name: good.name,
          login: account.login,
          password: account.password,
          date: Date.now()
        });
        db.prepare('UPDATE users SET purchases = ? WHERE vk_id = ?').run(JSON.stringify(purchases), vkId);
        
        result += `✅ ${good.name}\n   🔑 ${account.login}:${account.password}\n\n`;
      } else {
        result += `❌ ${good.name} — временно нет\n\n`;
        allSuccess = false;
      }
    }
    
    // Очищаем корзину
    db.prepare('UPDATE users SET cart = ? WHERE vk_id = ?').run('[]', vkId);
    await ctx.send(result);
  }
  
  // История покупок
  else if (text === 'покупки' || text === 'мои покупки') {
    const user = db.prepare('SELECT purchases FROM users WHERE vk_id = ?').get(vkId);
    const purchases = JSON.parse(user.purchases);
    
    if (purchases.length === 0) {
      await ctx.send('У вас пока нет покупок');
      return;
    }
    
    let message = '📜 История покупок:\n\n';
    purchases.forEach((p, i) => {
      message += `${i+1}. ${p.name}\n   🔑 ${p.login}:${p.password}\n   📅 ${new Date(p.date).toLocaleDateString()}\n\n`;
    });
    await ctx.send(message);
  }
  
  // Команда по умолчанию
  else {
    await ctx.send(
      '🤖 Команды:\n' +
      '• каталог — список товаров\n' +
      '• корзина — посмотреть выбранное\n' +
      '• оплатить — купить всё из корзины\n' +
      '• покупки — получить логины и пароли'
    );
  }
});

// Запуск через Long Poll API (не требует вебхуков)
vk.updates.start().then(() => {
  console.log('✅ Бот запущен');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));
