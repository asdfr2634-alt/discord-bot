require('dotenv').config();
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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
});

const QURAN_URL = 'https://server8.mp3quran.net/afs/001.mp3';
const DAILY_GOAL = Number(process.env.DAILY_GOAL || 1000);

// 🔒 الرتب المسموح لها للأوامر المحمية
const ALLOWED_ROLES = [
  '1462992022486126644',
  '1463355611621101715'
];

// 🛡️ الأوامر المحمية فقط
const protectedCommands = ['ping', 'leave', 'dmall'];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err);
});

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

const players = new Map();

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
  color = '#0F9D9A'
}) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description || null)
    .setTimestamp();

  if (fields.length) embed.addFields(fields);
  if (footer) embed.setFooter({ text: footer });
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

async function createZekrEmbed(selectedZekr = randomZekr()) {
  const globalTotal = await getGlobalTotal();
  const dailyTotal = await getDailyTotal();

  return new EmbedBuilder()
    .setColor('#0F9D9A')
    .setAuthor({ name: 'نظام الأذكار' })
    .setTitle('📿 ذكر')
    .setDescription(`╭・${selectedZekr}\n╰・اذكر الله واطمئن قلبك`)
    .addFields(
      { name: 'الفضل', value: 'الذكر نور للقلب وطمأنينة للنفس', inline: false },
      { name: 'تنبيه', value: 'أكثروا من الصلاة على النبي ﷺ', inline: false },
      { name: 'العداد العام', value: String(globalTotal), inline: true },
      { name: 'عداد اليوم', value: `${dailyTotal}/${DAILY_GOAL}`, inline: true },
      { name: 'عدد الأذكار المتاحة', value: String(adhkar.length), inline: true }
    )
    .setFooter({ text: 'أذكار تلقائية • Discord Bot' })
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

const commands = [
  new SlashCommandBuilder()
    .setName('zekr')
    .setDescription('يرسل ذكرًا جميلًا مع أزرار'),

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

    const channel = await member.guild.channels.fetch(process.env.WELCOME_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    const embed = createEmbed({
      title: '👋 عضو جديد',
      description: `حياك الله ${member} في **${member.guild.name}**`,
      fields: [
        { name: 'العضو', value: `${member.user.tag}`, inline: true },
        { name: 'رقم العضو', value: `${member.user.id}`, inline: true },
        { name: 'نتمنى لك', value: 'وقتًا ممتعًا والتزامًا جميلًا بالقوانين', inline: false }
      ],
      thumbnail: member.user.displayAvatarURL({ dynamic: true, size: 1024 }),
      footer: 'نظام الترحيب'
    });

    await channel.send({ content: `${member}`, embeds: [embed] });
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

    // 🔒 حماية الأوامر المحددة
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
        } catch (error) {
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

client.login(process.env.TOKEN);