require('dotenv').config();

const http = require('http');

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits
} = require('discord.js');

const {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  entersState,
  VoiceConnectionStatus,
  AudioPlayerStatus
} = require('@discordjs/voice');

const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const QURAN_URL = 'https://server8.mp3quran.net/afs/001.mp3';
const DAILY_GOAL = Number(process.env.DAILY_GOAL || 1000);

const TEXT_AI_MODEL = 'llama-3.1-8b-instant';
const VISION_AI_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

const ALLOWED_ROLES = [
  '1462992022486126644',
  '1463355611621101715'
];

const protectedCommands = ['ping', 'leave', 'dmall'];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err);
});

const players = new Map();

const adhkar = [
  'سبحان الله',
  'الحمد لله',
  'لا إله إلا الله',
  'الله أكبر',
  'سبحان الله وبحمده',
  'سبحان الله العظيم',
  'أستغفر الله',
  'أستغفر الله العظيم وأتوب إليه',
  'لا حول ولا قوة إلا بالله',
  'اللهم صل وسلم على نبينا محمد',
  'حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم',
  'اللهم اغفر لي ولوالدي وللمؤمنين والمؤمنات',
  'اللهم إنك عفو تحب العفو فاعفُ عني',
  'اللهم آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار',
  'اللهم إني أسألك الجنة وأعوذ بك من النار',
  'اللهم اجعل القرآن ربيع قلبي ونور صدري',
  'اللهم إني أعوذ بك من الهم والحزن',
  'اللهم ارزقني حسن الخاتمة',
  'سبحان الله عدد خلقه ورضا نفسه وزنة عرشه ومداد كلماته',
  'رضيت بالله ربًا وبالإسلام دينًا وبمحمد ﷺ نبيًا',
  'اللهم إني أسألك الهدى والتقى والعفاف والغنى',
  'يا حي يا قيوم برحمتك أستغيث',
  'رب اشرح لي صدري ويسر لي أمري',
  'رب زدني علمًا',
  'اللهم ثبت قلبي على دينك',
  'لا إله إلا أنت سبحانك إني كنت من الظالمين',
  'أعوذ بكلمات الله التامات من شر ما خلق',
  'اللهم إني أسألك العفو والعافية في الدنيا والآخرة',
  'اللهم تقبل توبتي واغسل حوبتي وأجب دعوتي',
  'اللهم احفظني من بين يدي ومن خلفي وعن يميني وعن شمالي',
  'اللهم إني أعوذ بك من زوال نعمتك وتحول عافيتك',
  'اللهم فرج همي ويسر أمري',
  'اللهم ارزقني من حيث لا أحتسب',
  'اللهم بارك لي في وقتي وعملي ومالي',
  'اللهم اجعلني من الذاكرين الشاكرين',
  'اللهم اجعل آخر كلامي من الدنيا لا إله إلا الله',
  'ربنا تقبل منا إنك أنت السميع العليم',
  'ربنا اغفر لنا ولوالدينا ولجميع المسلمين'
];

const rankTiers = [
  { name: 'مبتدئ', min: 0 },
  { name: 'نشيط', min: 50 },
  { name: 'ذاكر', min: 150 },
  { name: 'مثابر', min: 300 },
  { name: 'قدوة', min: 600 },
  { name: 'أسطورة الذكر', min: 1000 }
];
function startDashboardServer() {
  http.createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/health')) {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('OK');
      }

      let stats = {
        globalTotal: '0',
        dailyTotal: '0',
        usersCount: '0',
        subscribersCount: '0',
        memoryCount: '0'
      };

      try {
        stats.globalTotal = await getStat('global_zekr_total', '0');
        stats.dailyTotal = await getStat('daily_zekr_total', '0');

        const usersResult = await pool.query('SELECT COUNT(*) FROM user_zekr_counts');
        const subsResult = await pool.query('SELECT COUNT(*) FROM dm_subscribers WHERE subscribed = TRUE');
        const memoryResult = await pool.query('SELECT COUNT(*) FROM ai_memory');

        stats.usersCount = usersResult.rows[0].count;
        stats.subscribersCount = subsResult.rows[0].count;
        stats.memoryCount = memoryResult.rows[0].count;
      } catch (_) {}

      const botTag = client.user?.tag || 'Not logged in yet';
      const botAvatar = client.user?.displayAvatarURL?.({ size: 256 }) || '';
      const uptime = Math.floor(process.uptime());
      const uptimeHours = Math.floor(uptime / 3600);
      const uptimeMinutes = Math.floor((uptime % 3600) / 60);
      const guild = client.guilds.cache.first();
      const guildName = guild?.name || 'Discord Server';
      const memberCount = guild?.memberCount || 0;
      const apiPing = Math.round(client.ws.ping || 0);

      const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Time Dosn Dashboard</title>
<style>
*{box-sizing:border-box}
body{
  margin:0;
  font-family:Tahoma,Arial,sans-serif;
  background:
    radial-gradient(circle at 18% 8%,rgba(0,195,255,.22),transparent 32%),
    radial-gradient(circle at 85% 15%,rgba(0,80,255,.22),transparent 34%),
    linear-gradient(135deg,#020617,#061526 45%,#020617);
  color:#eaf6ff;
  min-height:100vh;
}
.layout{
  display:grid;
  grid-template-columns:270px 1fr;
  gap:18px;
  max-width:1500px;
  margin:auto;
  padding:20px;
}
.sidebar,.card,.hero,.panel{
  background:rgba(3,12,28,.78);
  border:1px solid rgba(56,189,248,.28);
  border-radius:24px;
  box-shadow:0 0 45px rgba(14,165,233,.12);
  backdrop-filter:blur(14px);
}
.sidebar{
  padding:22px;
  position:sticky;
  top:20px;
  height:calc(100vh - 40px);
}
.brand{
  display:flex;
  align-items:center;
  gap:12px;
  margin-bottom:28px;
}
.logo{
  width:64px;
  height:64px;
  border-radius:50%;
  border:2px solid #38bdf8;
  box-shadow:0 0 28px rgba(56,189,248,.55);
}
.nav{
  display:flex;
  flex-direction:column;
  gap:10px;
}
.nav div{
  padding:14px 16px;
  border-radius:16px;
  color:#bfeaff;
  background:rgba(14,165,233,.05);
  border:1px solid transparent;
}
.nav div.active,.nav div:hover{
  background:linear-gradient(90deg,#0284c7,#0ea5e9);
  color:white;
  box-shadow:0 0 25px rgba(14,165,233,.38);
}
.main{display:flex;flex-direction:column;gap:18px}
.hero{
  padding:26px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:20px;
}
.botbox{
  display:flex;
  align-items:center;
  gap:18px;
}
.avatar{
  width:110px;
  height:110px;
  border-radius:50%;
  border:3px solid #0ea5e9;
  box-shadow:0 0 35px rgba(14,165,233,.55);
}
.status{
  display:inline-block;
  margin-top:8px;
  color:#22c55e;
  font-weight:bold;
}
.muted{color:#9cc8df}
h1,h2,h3,p{margin:0}
.stats{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
  gap:16px;
}
.card{
  padding:20px;
  min-height:135px;
}
.icon{
  font-size:30px;
  margin-bottom:12px;
}
.num{
  font-size:34px;
  font-weight:900;
  margin-top:10px;
  color:#fff;
  text-shadow:0 0 16px rgba(56,189,248,.45);
}
.section{
  display:grid;
  grid-template-columns:1.2fr .8fr;
  gap:18px;
}
.panel{padding:22px}
.systems{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
  gap:14px;
  margin-top:16px;
}
.sys{
  padding:18px;
  border-radius:18px;
  border:1px solid rgba(56,189,248,.18);
  background:rgba(14,165,233,.07);
}
.ok{color:#22c55e;font-weight:bold}
.commands{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
  gap:14px;
  margin-top:16px;
}
.cmdcat{
  border-radius:18px;
  padding:16px;
  border:1px solid rgba(56,189,248,.18);
  background:rgba(14,165,233,.07);
}
.cmd{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:10px 0;
  border-bottom:1px solid rgba(255,255,255,.06);
}
.cmd:last-child{border-bottom:none}
.code{
  color:#38bdf8;
  font-weight:bold;
}
.footer{
  text-align:center;
  color:#7aaac2;
  padding:12px;
}
@media(max-width:950px){
  .layout{grid-template-columns:1fr}
  .sidebar{position:relative;height:auto}
  .section{grid-template-columns:1fr}
  .hero{flex-direction:column;align-items:flex-start}
}
</style>
</head>
<body>

<div class="layout">

  <aside class="sidebar">
    <div class="brand">
      ${botAvatar ? `<img class="logo" src="${botAvatar}">` : `<div class="logo"></div>`}
      <div>
        <h2>Time Dosn</h2>
        <p class="muted">Discord Bot</p>
      </div>
    </div>

    <div class="nav">
      <div class="active">🏠 الرئيسية</div>
      <div>💓 حالة البوت</div>
      <div>📋 الأوامر</div>
      <div>📿 الأذكار</div>
      <div>🧠 الذكاء الاصطناعي</div>
      <div>👥 الأعضاء</div>
      <div>📊 الإحصائيات</div>
      <div>🔒 عرض فقط</div>
    </div>
  </aside>

  <main class="main">

    <section class="hero">
      <div class="botbox">
        ${botAvatar ? `<img class="avatar" src="${botAvatar}">` : `<div class="avatar"></div>`}
        <div>
          <h1>${botTag}</h1>
          <p class="muted">بوت ديسكورد متعدد الوظائف مع الأذكار والذكاء الاصطناعي</p>
          <span class="status">● Online</span>
        </div>
      </div>
      <div class="card" style="min-width:260px">
        <p class="muted">السيرفر</p>
        <h2>${guildName}</h2>
        <p class="muted" style="margin-top:10px">مدة التشغيل: ${uptimeHours} ساعة و ${uptimeMinutes} دقيقة</p>
      </div>
    </section>

    <section class="stats">
      <div class="card"><div class="icon">📿</div><p class="muted">إجمالي الأذكار</p><div class="num">${stats.globalTotal}</div></div>
      <div class="card"><div class="icon">🎯</div><p class="muted">تحدي اليوم</p><div class="num">${stats.dailyTotal}/${DAILY_GOAL}</div></div>
      <div class="card"><div class="icon">👥</div><p class="muted">أعضاء السيرفر</p><div class="num">${memberCount}</div></div>
      <div class="card"><div class="icon">✉️</div><p class="muted">مشتركين DM</p><div class="num">${stats.subscribersCount}</div></div>
      <div class="card"><div class="icon">🧠</div><p class="muted">ذاكرة AI</p><div class="num">${stats.memoryCount}</div></div>
    </section>

    <section class="section">
      <div class="panel">
        <h2>💓 حالة الأنظمة</h2>
        <div class="systems">
          <div class="sys"><h3>🧠 الذكاء الاصطناعي</h3><p class="ok">يعمل</p><p class="muted">Groq AI + Vision</p></div>
          <div class="sys"><h3>💾 قاعدة البيانات</h3><p class="ok">متصلة</p><p class="muted">PostgreSQL</p></div>
          <div class="sys"><h3>🎧 النظام الصوتي</h3><p class="ok">جاهز</p><p class="muted">Quran Voice</p></div>
          <div class="sys"><h3>⚡ Ping</h3><p class="ok">${apiPing}ms</p><p class="muted">Discord Gateway</p></div>
        </div>
      </div>

      <div class="panel">
        <h2>🔐 أمان اللوحة</h2>
        <div class="systems">
          <div class="sys"><h3>عرض فقط</h3><p class="ok">آمن</p><p class="muted">لا يوجد تعديل أو حذف</p></div>
          <div class="sys"><h3>الأسرار</h3><p class="ok">مخفية</p><p class="muted">لا تظهر التوكنات أو المفاتيح</p></div>
        </div>
      </div>
    </section>

    <section class="panel">
      <h2>📋 صفحة الأوامر</h2>
      <div class="commands">
        <div class="cmdcat">
          <h3>🤖 الذكاء</h3>
          <div class="cmd"><span class="code">/ai</span><span>اسأل الذكاء</span></div>
          <div class="cmd"><span class="code">/aiclear</span><span>مسح الذاكرة</span></div>
        </div>

        <div class="cmdcat">
          <h3>📿 الأذكار</h3>
          <div class="cmd"><span class="code">/zekr</span><span>ذكر عشوائي</span></div>
          <div class="cmd"><span class="code">/rank</span><span>رتبتك</span></div>
          <div class="cmd"><span class="code">/top</span><span>المتصدرين</span></div>
          <div class="cmd"><span class="code">/challenge</span><span>تحدي اليوم</span></div>
        </div>

        <div class="cmdcat">
          <h3>🎧 الصوت</h3>
          <div class="cmd"><span class="code">/join</span><span>دخول الروم</span></div>
          <div class="cmd"><span class="code">/quran</span><span>تشغيل القرآن</span></div>
          <div class="cmd"><span class="code">/stopquran</span><span>إيقاف</span></div>
          <div class="cmd"><span class="code">/leave</span><span>خروج</span></div>
        </div>

        <div class="cmdcat">
          <h3>👤 معلومات</h3>
          <div class="cmd"><span class="code">/avatar</span><span>صورة العضو</span></div>
          <div class="cmd"><span class="code">/userinfo</span><span>معلومات عضو</span></div>
          <div class="cmd"><span class="code">/server</span><span>معلومات السيرفر</span></div>
          <div class="cmd"><span class="code">/dashboard</span><span>رابط اللوحة</span></div>
        </div>
      </div>
    </section>

    <div class="footer">© Time Dosn Bot • Dark Blue & Cyan Dashboard • Read Only</div>

  </main>
</div>

</body>
</html>`;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (error) {
      console.error('Dashboard Error:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Dashboard Error');
    }
  }).listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server running on port ${PORT}`);
  });
}

function getTodayRiyadh() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function randomZekr() {
  return adhkar[Math.floor(Math.random() * adhkar.length)];
}

function getRankByCount(count) {
  let currentRank = rankTiers[0];
  for (const tier of rankTiers) {
    if (count >= tier.min) currentRank = tier;
  }
  return currentRank;
}

function getNextRank(count) {
  return rankTiers.find((tier) => tier.min > count) || null;
}

function createEmbed({
  title,
  description,
  fields = [],
  footer = null,
  image = null,
  thumbnail = null,
  color = '#0EA5E9'
}) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({
      name: 'Time Dosn • Premium System',
      iconURL: client.user?.displayAvatarURL() || undefined
    })
    .setTitle(title)
    .setDescription(description || ' ')
    .setTimestamp()
    .setFooter({
      text: footer || 'Time Dosn Bot • Dark Blue Edition',
      iconURL: client.user?.displayAvatarURL() || undefined
    });

  if (fields.length) embed.addFields(fields);
  if (image) embed.setImage(image);
  if (thumbnail) embed.setThumbnail(thumbnail);

  return embed;
}

function createDmReadButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('dm_seen')
      .setLabel('تم الاطلاع')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
  );
}

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_stats (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_zekr_counts (
      user_id TEXT PRIMARY KEY,
      count BIGINT NOT NULL DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dm_subscribers (
      user_id TEXT PRIMARY KEY,
      subscribed BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_memory (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(
    `
    INSERT INTO bot_stats (key, value) VALUES
    ('global_zekr_total', '0'),
    ('daily_zekr_total', '0'),
    ('daily_zekr_date', $1)
    ON CONFLICT (key) DO NOTHING
    `,
    [getTodayRiyadh()]
  );

  await ensureDailyChallengeFresh();
  console.log('✅ تم تجهيز قاعدة البيانات');
}

async function getStat(key, defaultValue = '0') {
  const result = await pool.query(
    'SELECT value FROM bot_stats WHERE key = $1',
    [key]
  );

  if (!result.rows.length) return defaultValue;
  return result.rows[0].value;
}

async function setStat(key, value) {
  await pool.query(
    `
    INSERT INTO bot_stats (key, value)
    VALUES ($1, $2)
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value
    `,
    [key, String(value)]
  );
}

async function ensureDailyChallengeFresh() {
  const today = getTodayRiyadh();
  const currentDate = await getStat('daily_zekr_date', today);

  if (currentDate !== today) {
    await setStat('daily_zekr_date', today);
    await setStat('daily_zekr_total', 0);
    console.log(`🔄 تم تصفير التحدي اليومي: ${today}`);
  }
}

async function getGlobalTotal() {
  return Number(await getStat('global_zekr_total', '0')) || 0;
}

async function increaseGlobalTotal() {
  const current = await getGlobalTotal();
  const next = current + 1;
  await setStat('global_zekr_total', next);
  return next;
}

async function getDailyTotal() {
  await ensureDailyChallengeFresh();
  return Number(await getStat('daily_zekr_total', '0')) || 0;
}

async function increaseDailyTotal() {
  await ensureDailyChallengeFresh();
  const current = await getDailyTotal();
  const next = current + 1;
  await setStat('daily_zekr_total', next);
  return next;
}

async function getUserCount(userId) {
  const result = await pool.query(
    'SELECT count FROM user_zekr_counts WHERE user_id = $1',
    [userId]
  );

  if (!result.rows.length) return 0;
  return Number(result.rows[0].count) || 0;
}

async function increaseUserCount(userId) {
  const result = await pool.query(
    `
    INSERT INTO user_zekr_counts (user_id, count)
    VALUES ($1, 1)
    ON CONFLICT (user_id)
    DO UPDATE SET count = user_zekr_counts.count + 1
    RETURNING count
    `,
    [userId]
  );

  return Number(result.rows[0].count) || 0;
}

async function getTopUsers(limit = 10) {
  const result = await pool.query(
    `
    SELECT user_id, count
    FROM user_zekr_counts
    ORDER BY count DESC, user_id ASC
    LIMIT $1
    `,
    [limit]
  );

  return result.rows.map((row) => ({
    userId: row.user_id,
    count: Number(row.count) || 0
  }));
}

async function subscribeUser(userId) {
  await pool.query(
    `
    INSERT INTO dm_subscribers (user_id, subscribed)
    VALUES ($1, TRUE)
    ON CONFLICT (user_id)
    DO UPDATE SET subscribed = TRUE
    `,
    [userId]
  );
}

async function unsubscribeUser(userId) {
  await pool.query(
    `
    INSERT INTO dm_subscribers (user_id, subscribed)
    VALUES ($1, FALSE)
    ON CONFLICT (user_id)
    DO UPDATE SET subscribed = FALSE
    `,
    [userId]
  );
}

async function getSubscribedUsers() {
  const result = await pool.query(`
    SELECT user_id
    FROM dm_subscribers
    WHERE subscribed = TRUE
    ORDER BY created_at ASC
  `);

  return result.rows.map((row) => row.user_id);
}

async function saveAiMemory(userId, role, content) {
  await pool.query(
    'INSERT INTO ai_memory (user_id, role, content) VALUES ($1, $2, $3)',
    [userId, role, content.slice(0, 3000)]
  );

  await pool.query(
    `
    DELETE FROM ai_memory
    WHERE id IN (
      SELECT id FROM ai_memory
      WHERE user_id = $1
      ORDER BY created_at DESC
      OFFSET 12
    )
    `,
    [userId]
  );
}

async function getAiMemory(userId) {
  const result = await pool.query(
    `
    SELECT role, content
    FROM ai_memory
    WHERE user_id = $1
    ORDER BY created_at ASC
    LIMIT 12
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    role: row.role,
    content: row.content
  }));
}

async function clearAiMemory(userId) {
  await pool.query('DELETE FROM ai_memory WHERE user_id = $1', [userId]);
}

async function askGroq({ userId, question, imageUrl = null }) {
  if (!process.env.GROQ_API_KEY) {
    return '❌ مفتاح GROQ_API_KEY غير موجود في Render Environment.';
  }

  try {
    const memory = imageUrl ? [] : await getAiMemory(userId);

    const messages = [
      {
        role: 'system',
        content:
          'أنت مساعد ذكي داخل سيرفر ديسكورد خاص. أجب بالعربية بشكل واضح ومفيد ومختصر. إذا سألك المستخدم عن شيء سابق، استخدم الذاكرة المتاحة فقط.'
      },
      ...memory
    ];

    if (imageUrl) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: `حلل الصورة أو أجب عن السؤال التالي بالعربية:\n${question}`
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          }
        ]
      });
    } else {
      messages.push({
        role: 'user',
        content: question
      });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: imageUrl ? VISION_AI_MODEL : TEXT_AI_MODEL,
        messages,
        temperature: 0.7,
        max_completion_tokens: imageUrl ? 1000 : 800
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Groq API Error:', data);
      return `❌ صار خطأ من Groq API: ${data?.error?.message || 'غير معروف'}`;
    }

    const answer = data?.choices?.[0]?.message?.content || '❌ ما قدرت أطلع رد مناسب.';

    if (!imageUrl) {
      await saveAiMemory(userId, 'user', question);
      await saveAiMemory(userId, 'assistant', answer);
    }

    return answer;
  } catch (error) {
    console.error('❌ خطأ في askGroq:', error);
    return '❌ صار خطأ أثناء الاتصال بالذكاء الاصطناعي.';
  }
}

async function createZekrEmbed(selectedZekr = randomZekr()) {
  const globalTotal = await getGlobalTotal();
  const dailyTotal = await getDailyTotal();
  const percent = Math.min(100, Math.floor((dailyTotal / DAILY_GOAL) * 100));
  const progressBar =
    '▰'.repeat(Math.floor(percent / 10)) +
    '▱'.repeat(10 - Math.floor(percent / 10));

  return new EmbedBuilder()
    .setColor('#0284C7')
    .setAuthor({
      name: 'Time Dosn • نظام الأذكار',
      iconURL: client.user?.displayAvatarURL() || undefined
    })
    .setTitle('📿 ذكر اليوم')
    .setDescription(
      `> ﴿ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ ﴾\n\n` +
      `**${selectedZekr}**\n\n` +
      `━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      { name: '✨ الفضل', value: 'الذكر نور للقلب وطمأنينة للنفس', inline: false },
      { name: '🌍 العداد العام', value: `\`${globalTotal}\``, inline: true },
      { name: '🎯 تحدي اليوم', value: `\`${dailyTotal}/${DAILY_GOAL}\``, inline: true },
      { name: '📊 التقدم', value: `\`${progressBar}\` ${percent}%`, inline: false }
    )
    .setThumbnail(client.user?.displayAvatarURL() || null)
    .setFooter({
      text: 'Time Dosn Bot • أذكار تلقائية',
      iconURL: client.user?.displayAvatarURL() || undefined
    })
    .setTimestamp();
}

function createZekrButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('new_zekr')
      .setLabel('ذكر جديد')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('count_zekr')
      .setLabel('ذكرت')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
  );
}

async function sendDmReadLog(user) {
  try {
    if (!process.env.LOG_CHANNEL_ID) return;

    const logChannel = await client.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('✅ تم الاطلاع على رسالة DM')
      .setDescription('أحد المشتركين اطّلع على الرسالة الإدارية')
      .addFields(
        { name: 'العضو', value: `${user} (${user.tag})`, inline: false },
        { name: 'آيدي العضو', value: user.id, inline: true }
      )
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 1024 }))
      .setFooter({ text: 'DM Read Logs' })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('❌ خطأ في لوق تم الاطلاع:', error);
  }
}

async function sendPermissionLog(interaction) {
  try {
    if (!process.env.LOG_CHANNEL_ID) return;

    const logChannel = await interaction.guild.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
    if (!logChannel) return;

    const logEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🚨 محاولة استخدام أمر محمي')
      .setDescription('تم رصد محاولة استخدام أمر بدون صلاحية')
      .addFields(
        { name: 'العضو', value: `${interaction.user} (${interaction.user.tag})`, inline: false },
        { name: 'آيدي العضو', value: interaction.user.id, inline: true },
        { name: 'الأمر', value: `/${interaction.commandName}`, inline: true },
        { name: 'السيرفر', value: interaction.guild.name, inline: true }
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 1024 }))
      .setFooter({ text: 'Protection Logs' })
      .setTimestamp();

    await logChannel.send({ embeds: [logEmbed] });
  } catch (error) {
    console.error('❌ خطأ في إرسال اللوق:', error);
  }
}

function createDeniedEmbed() {
  return new EmbedBuilder()
    .setColor('#ED4245')
    .setTitle('🚫 رفض الوصول')
    .setDescription('ليس لديك الصلاحية لاستخدام هذا الأمر.')
    .addFields(
      { name: 'ملاحظة', value: 'هذا الأمر مخصص لرتب إدارية محددة فقط.', inline: false }
    )
    .setFooter({ text: 'نظام الحماية' })
    .setTimestamp();
}

const commands = [
  new SlashCommandBuilder()
    .setName('zekr')
    .setDescription('يرسل ذكرًا جميلًا مع أزرار'),

  new SlashCommandBuilder()
    .setName('ai')
    .setDescription('اسأل الذكاء الاصطناعي أو ارفع صورة')
    .addStringOption(option =>
      option.setName('question')
        .setDescription('اكتب سؤالك')
        .setRequired(true)
    )
    .addAttachmentOption(option =>
      option.setName('image')
        .setDescription('ارفع صورة للذكاء يحللها')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('aiclear')
    .setDescription('مسح ذاكرة الذكاء الخاصة بك'),

  new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('يعطيك رابط لوحة الويب'),

  new SlashCommandBuilder()
    .setName('rank')
    .setDescription('يعرض رتبتك وعدد أذكارك')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('العضو المطلوب')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('top')
    .setDescription('يعرض أكثر 10 أعضاء ذكرًا'),

  new SlashCommandBuilder()
    .setName('challenge')
    .setDescription('يعرض التحدي اليومي'),

  new SlashCommandBuilder()
    .setName('subscribe')
    .setDescription('الاشتراك في الرسائل الخاصة الخاصة بالإدارة'),

  new SlashCommandBuilder()
    .setName('unsubscribe')
    .setDescription('إلغاء الاشتراك في الرسائل الخاصة'),

  new SlashCommandBuilder()
    .setName('dmall')
    .setDescription('إرسال رسالة خاصة للمشتركين فقط')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('الرسالة')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('join')
    .setDescription('يدخل البوت إلى الروم الصوتي'),

  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('يخرج البوت من الروم الصوتي'),

  new SlashCommandBuilder()
    .setName('quran')
    .setDescription('يشغل القرآن في الروم الصوتي'),

  new SlashCommandBuilder()
    .setName('stopquran')
    .setDescription('يوقف تشغيل القرآن'),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('يعرض سرعة البوت'),

  new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('يعرض صورة العضو')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('العضو المطلوب')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('يعرض معلومات العضو')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('العضو المطلوب')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('server')
    .setDescription('يعرض معلومات السيرفر'),

  new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('إرسال اقتراح')
    .addStringOption(option =>
      option.setName('text')
        .setDescription('اكتب اقتراحك')
        .setRequired(true)
    )
].map((command) => command.toJSON());

async function registerSlashCommands() {
  console.log('⏳ جاري تسجيل أوامر السلاش...');
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );

  console.log('✅ تم تسجيل أوامر السلاش');
}

function getOrCreatePlayer(guildId) {
  if (!players.has(guildId)) {
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
    });

    player.on('error', (error) => {
      console.error('❌ خطأ في مشغل الصوت:', error.message);
    });

    player.on(AudioPlayerStatus.Playing, () => {
      console.log('▶️ بدأ تشغيل الصوت');
    });

    player.on(AudioPlayerStatus.Idle, () => {
      console.log('⏹️ توقف الصوت');
    });

    players.set(guildId, player);
  }

  return players.get(guildId);
}

async function connectToVoice(interaction) {
  const channel = interaction.member.voice.channel;
  if (!channel) throw new Error('VOICE_REQUIRED');

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: interaction.guild.id,
    adapterCreator: interaction.guild.voiceAdapterCreator,
    selfDeaf: false
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
  return connection;
}

client.once('clientReady', async () => {
  try {
    console.log(`🔥 Logged in as ${client.user.tag}`);

    if (!process.env.TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
      console.error('❌ تأكد من TOKEN / CLIENT_ID / GUILD_ID');
      return;
    }

    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL غير موجود');
      return;
    }

    await initDatabase();
    await registerSlashCommands();

    if (process.env.AZKAR_CHANNEL_ID) {
      setInterval(async () => {
        try {
          const channel = await client.channels.fetch(process.env.AZKAR_CHANNEL_ID).catch(() => null);
          if (!channel) return;

          await channel.send({
            embeds: [await createZekrEmbed()],
            components: [createZekrButtons()]
          });
        } catch (error) {
          console.error('❌ خطأ في إرسال الذكر التلقائي:', error);
        }
      }, 1800000);
    }
  } catch (error) {
    console.error('❌ خطأ أثناء تشغيل البوت:', error);
  }
});

client.on('guildMemberAdd', async (member) => {
  try {
    if (!process.env.WELCOME_CHANNEL_ID) return;

    const channel = await member.guild.channels
      .fetch(process.env.WELCOME_CHANNEL_ID)
      .catch(() => null);

    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor('#C6A55C')
      .setAuthor({
        name: `${member.guild.name} • Welcome`,
        iconURL:
          member.guild.iconURL({ dynamic: true }) ||
          client.user.displayAvatarURL()
      })
      .setTitle(`Welcome, ${member.user.username}`)
      .setDescription(
        [
          `> We are delighted to welcome you to **${member.guild.name}**.`,
          `> Please take a moment to read the rules and enjoy your stay.`,
          `> We hope you have a great experience with us.`
        ].join('\n')
      )
      .addFields(
        { name: 'Member', value: `${member}`, inline: true },
        { name: 'Tag', value: `\`${member.user.tag}\``, inline: true },
        { name: 'Members', value: `\`${member.guild.memberCount}\``, inline: true }
      )
      .setThumbnail(
        member.user.displayAvatarURL({ dynamic: true, size: 1024 })
      )
      .setFooter({
        text: `${member.guild.name} • Premium Welcome System`,
        iconURL: member.guild.iconURL({ dynamic: true }) || undefined
      })
      .setTimestamp();

    await channel.send({
      content: `✨ Welcome ${member}`,
      embeds: [embed]
    });
  } catch (error) {
    console.error('❌ خطأ في رسالة الترحيب:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isButton()) {
      if (interaction.customId === 'new_zekr') {
        return await interaction.update({
          embeds: [await createZekrEmbed()],
          components: [createZekrButtons()]
        });
      }

      if (interaction.customId === 'count_zekr') {
        const beforeCount = await getUserCount(interaction.user.id);
        const personalCount = await increaseUserCount(interaction.user.id);
        const totalCount = await increaseGlobalTotal();
        const dailyTotal = await increaseDailyTotal();

        const currentRank = getRankByCount(personalCount);
        const previousRank = getRankByCount(beforeCount);
        const nextRank = getNextRank(personalCount);

        let extraText = `📿 عدد مرات ذكرك: ${personalCount}\n🌍 العداد العام: ${totalCount}\n🎯 تقدم اليوم: ${dailyTotal}/${DAILY_GOAL}\n🏅 رتبتك: ${currentRank.name}`;

        if (currentRank.name !== previousRank.name) {
          extraText += `\n🎉 مبروك! وصلت رتبة جديدة: ${currentRank.name}`;
        }

        if (nextRank) {
          extraText += `\n⬆️ باقي ${nextRank.min - personalCount} للوصول إلى رتبة ${nextRank.name}`;
        }

        await interaction.update({
          embeds: [await createZekrEmbed()],
          components: [createZekrButtons()]
        });

        return await interaction.followUp({
          content: `✅ تم احتسابها لك\n${extraText}`,
          ephemeral: true
        });
      }

      if (interaction.customId === 'dm_seen') {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('dm_seen_done')
            .setLabel('تم الاطلاع ✅')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );

        await interaction.update({
          components: [disabledRow]
        });

        await sendDmReadLog(interaction.user);
        return;
      }

      return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (protectedCommands.includes(interaction.commandName)) {
      const member = interaction.member;
      const hasPermission = member.roles.cache.some(role => ALLOWED_ROLES.includes(role.id));

      if (!hasPermission) {
        await sendPermissionLog(interaction);
        return await interaction.reply({
          embeds: [createDeniedEmbed()],
          ephemeral: true
        });
      }
    }

    if (interaction.commandName === 'ai') {
      await interaction.deferReply();

      const question = interaction.options.getString('question');
      const image = interaction.options.getAttachment('image');

      if (image && !image.contentType?.startsWith('image/')) {
        return await interaction.editReply('❌ الملف المرفق لازم يكون صورة.');
      }

      const answer = await askGroq({
        userId: interaction.user.id,
        question,
        imageUrl: image?.url || null
      });

      return await interaction.editReply({
        embeds: [createEmbed({
          title: image ? '🖼️ ذكاء الصور' : '🤖 الذكاء الاصطناعي',
          description: answer.slice(0, 4000),
          fields: [
            { name: 'سؤالك', value: question.slice(0, 1000), inline: false },
            { name: 'الذاكرة', value: image ? 'لا تُحفظ أسئلة الصور في الذاكرة' : 'تم حفظ المحادثة في ذاكرتك الخاصة', inline: false }
          ],
          image: image?.url || null,
          footer: image ? 'Groq Vision AI' : 'Groq AI Memory'
        })]
      });
    }

    if (interaction.commandName === 'aiclear') {
      await clearAiMemory(interaction.user.id);
      return await interaction.reply({
        content: '✅ تم مسح ذاكرة الذكاء الخاصة بك.',
        ephemeral: true
      });
    }

    if (interaction.commandName === 'dashboard') {
      await interaction.deferReply({ ephemeral: true });

      const dashboardUrl =
        process.env.RENDER_EXTERNAL_URL ||
        'https://discord-bot-5h8e.onrender.com';

      return await interaction.editReply({
        content: `🌐 رابط لوحة الويب:\n${dashboardUrl}`
      });
    }

    if (interaction.commandName === 'zekr') {
      await interaction.deferReply();
      return await interaction.editReply({
        embeds: [await createZekrEmbed()],
        components: [createZekrButtons()]
      });
    }

    if (interaction.commandName === 'rank') {
      await interaction.deferReply();
      const user = interaction.options.getUser('user') || interaction.user;
      const count = await getUserCount(user.id);
      const rank = getRankByCount(count);
      const nextRank = getNextRank(count);

      const fields = [
        { name: 'العضو', value: `${user}`, inline: true },
        { name: 'عدد الأذكار', value: `${count}`, inline: true },
        { name: 'الرتبة الحالية', value: rank.name, inline: true }
      ];

      if (nextRank) {
        fields.push({
          name: 'الرتبة التالية',
          value: `${nextRank.name} (باقي ${nextRank.min - count})`,
          inline: false
        });
      }

      return await interaction.editReply({
        embeds: [createEmbed({
          title: '🏅 الرتبة والأذكار',
          thumbnail: user.displayAvatarURL({ dynamic: true, size: 1024 }),
          fields,
          footer: 'Rank System'
        })]
      });
    }

    if (interaction.commandName === 'top') {
      await interaction.deferReply();
      const topUsers = await getTopUsers(10);

      if (!topUsers.length) {
        return await interaction.editReply('❌ لا توجد بيانات كافية بعد');
      }

      let description = '';
      for (let i = 0; i < topUsers.length; i++) {
        description += `**${i + 1}.** <@${topUsers[i].userId}> — \`${topUsers[i].count}\`\n`;
      }

      return await interaction.editReply({
        embeds: [createEmbed({
          title: '🏆 أعلى 10 في الأذكار',
          description,
          footer: 'Top 10'
        })]
      });
    }

    if (interaction.commandName === 'challenge') {
      await interaction.deferReply();
      const dailyTotal = await getDailyTotal();
      const percent = Math.min(100, Math.floor((dailyTotal / DAILY_GOAL) * 100));
      const remaining = Math.max(0, DAILY_GOAL - dailyTotal);

      return await interaction.editReply({
        embeds: [createEmbed({
          title: '🎯 التحدي اليومي',
          fields: [
            { name: 'تاريخ اليوم', value: getTodayRiyadh(), inline: true },
            { name: 'الهدف', value: `${DAILY_GOAL}`, inline: true },
            { name: 'المجموع الحالي', value: `${dailyTotal}`, inline: true },
            { name: 'نسبة الإنجاز', value: `${percent}%`, inline: true },
            { name: 'المتبقي', value: `${remaining}`, inline: true },
            { name: 'الحالة', value: dailyTotal >= DAILY_GOAL ? '✅ تم تحقيق الهدف' : '⏳ مستمر', inline: true }
          ],
          footer: 'Daily Challenge'
        })]
      });
    }

    if (interaction.commandName === 'subscribe') {
      await subscribeUser(interaction.user.id);
      return await interaction.reply({
        content: '✅ تم اشتراكك في الرسائل الخاصة الخاصة بالإدارة',
        ephemeral: true
      });
    }

    if (interaction.commandName === 'unsubscribe') {
      await unsubscribeUser(interaction.user.id);
      return await interaction.reply({
        content: '🛑 تم إلغاء اشتراكك من الرسائل الخاصة',
        ephemeral: true
      });
    }

    if (interaction.commandName === 'dmall') {
      await interaction.deferReply({ ephemeral: true });

      const message = interaction.options.getString('message');
      const subscribers = await getSubscribedUsers();

      if (!subscribers.length) {
        return await interaction.editReply('❌ لا يوجد مشتركين حاليًا');
      }

      let success = 0;
      let failed = 0;

      for (const userId of subscribers) {
        try {
          const user = await client.users.fetch(userId);

          const embed = new EmbedBuilder()
            .setColor('#0F9D9A')
            .setAuthor({
              name: 'إدارة السيرفر',
              iconURL: interaction.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL()
            })
            .setTitle('📩 رسالة إدارية')
            .setDescription(`📌 **محتوى الرسالة:**\n${message}`)
            .setThumbnail(
              interaction.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL()
            )
            .setFooter({ text: 'Time Dosn System' })
            .setTimestamp();

          await user.send({
            embeds: [embed],
            components: [createDmReadButtons()]
          });

          success++;
        } catch (_) {
          failed++;
        }
      }

      return await interaction.editReply(
        `✅ تم الإرسال للمشتركين\n📬 نجح: ${success}\n❌ فشل: ${failed}`
      );
    }

    if (interaction.commandName === 'join') {
      await interaction.deferReply({ ephemeral: true });
      await connectToVoice(interaction);
      return await interaction.editReply('🎧 دخلت الروم');
    }

    if (interaction.commandName === 'leave') {
      const connection = getVoiceConnection(interaction.guild.id);

      if (!connection) {
        return await interaction.reply({ content: '❌ مو داخل روم', ephemeral: true });
      }

      const player = players.get(interaction.guild.id);
      if (player) player.stop();
      connection.destroy();

      return await interaction.reply('👋 طلعت من الروم');
    }

    if (interaction.commandName === 'quran') {
      await interaction.deferReply({ ephemeral: true });
      const connection = await connectToVoice(interaction);
      const player = getOrCreatePlayer(interaction.guild.id);

      const resource = createAudioResource(QURAN_URL, { inlineVolume: true });
      if (resource.volume) resource.volume.setVolume(1);

      connection.subscribe(player);
      player.play(resource);

      return await interaction.editReply('📖 تم تشغيل القرآن');
    }

    if (interaction.commandName === 'stopquran') {
      const player = players.get(interaction.guild.id);

      if (!player) {
        return await interaction.reply({ content: '❌ ما فيه تشغيل حالي', ephemeral: true });
      }

      player.stop();
      return await interaction.reply('⏹️ تم إيقاف القرآن');
    }

    if (interaction.commandName === 'ping') {
      const apiPing = Math.round(client.ws.ping);
      return await interaction.reply({
        embeds: [createEmbed({
          title: '🏓 سرعة البوت',
          fields: [
            { name: 'Ping', value: `\`${apiPing}ms\``, inline: true },
            { name: 'السيرفر', value: `${interaction.guild.name}`, inline: true }
          ],
          footer: 'Discord Bot'
        })],
        ephemeral: true
      });
    }

    if (interaction.commandName === 'avatar') {
      const user = interaction.options.getUser('user') || interaction.user;
      return await interaction.reply({
        embeds: [createEmbed({
          title: `🖼️ صورة ${user.username}`,
          image: user.displayAvatarURL({ dynamic: true, size: 1024 }),
          footer: `Requested by ${interaction.user.username}`
        })]
      });
    }

    if (interaction.commandName === 'userinfo') {
      await interaction.deferReply();
      const user = interaction.options.getUser('user') || interaction.user;
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      const count = await getUserCount(user.id);
      const rank = getRankByCount(count);

      const roles = member
        ? member.roles.cache
            .filter(role => role.id !== interaction.guild.id)
            .map(role => role.toString())
            .slice(0, 10)
            .join(' ، ') || 'لا توجد رتب'
        : 'غير متوفر';

      return await interaction.editReply({
        embeds: [createEmbed({
          title: '👤 معلومات العضو',
          thumbnail: user.displayAvatarURL({ dynamic: true, size: 1024 }),
          fields: [
            { name: 'الاسم', value: `${user.tag}`, inline: true },
            { name: 'الآيدي', value: `${user.id}`, inline: true },
            { name: 'بوت؟', value: user.bot ? 'نعم' : 'لا', inline: true },
            { name: 'عدد الأذكار', value: `${count}`, inline: true },
            { name: 'الرتبة', value: rank.name, inline: true },
            { name: 'تاريخ إنشاء الحساب', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: false },
            { name: 'تاريخ دخول السيرفر', value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : 'غير متوفر', inline: false },
            { name: 'الرتب', value: roles, inline: false }
          ],
          footer: 'User Info'
        })]
      });
    }

    if (interaction.commandName === 'server') {
      return await interaction.reply({
        embeds: [createEmbed({
          title: '🟢 معلومات السيرفر',
          thumbnail: interaction.guild.iconURL({ dynamic: true, size: 1024 }) || null,
          fields: [
            { name: 'اسم السيرفر', value: interaction.guild.name, inline: true },
            { name: 'آيدي السيرفر', value: interaction.guild.id, inline: true },
            { name: 'المالك', value: `<@${interaction.guild.ownerId}>`, inline: true },
            { name: 'عدد الأعضاء', value: `${interaction.guild.memberCount}`, inline: true },
            { name: 'عدد الرومات', value: `${interaction.guild.channels.cache.size}`, inline: true },
            { name: 'تاريخ الإنشاء', value: `<t:${Math.floor(interaction.guild.createdTimestamp / 1000)}:F>`, inline: false }
          ],
          footer: 'Server Info'
        })]
      });
    }

    if (interaction.commandName === 'suggest') {
      await interaction.deferReply({ ephemeral: true });
      const text = interaction.options.getString('text');

      if (!process.env.SUGGEST_CHANNEL_ID) {
        return await interaction.editReply('❌ روم الاقتراحات غير مضبوط في المتغيرات');
      }

      const suggestChannel = await interaction.guild.channels.fetch(process.env.SUGGEST_CHANNEL_ID).catch(() => null);
      if (!suggestChannel) {
        return await interaction.editReply('❌ ما قدرت أوصل لروم الاقتراحات');
      }

      const embed = createEmbed({
        title: '📩 اقتراح جديد',
        description: text,
        fields: [
          { name: 'صاحب الاقتراح', value: `${interaction.user}`, inline: true },
          { name: 'الآيدي', value: `${interaction.user.id}`, inline: true }
        ],
        thumbnail: interaction.user.displayAvatarURL({ dynamic: true, size: 1024 }),
        footer: 'Suggestion System'
      });

      const msg = await suggestChannel.send({ embeds: [embed] });
      await msg.react('👍').catch(() => null);
      await msg.react('👎').catch(() => null);

      return await interaction.editReply('✅ تم إرسال اقتراحك بنجاح');
    }
  } catch (error) {
    console.error('❌ خطأ داخل interactionCreate:', error);

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('❌ صار خطأ أثناء تنفيذ الأمر');
      } else {
        await interaction.reply({ content: '❌ صار خطأ أثناء تنفيذ الأمر', ephemeral: true });
      }
    } catch (_) {}
  }
});

startDashboardServer();
client.login(process.env.TOKEN);