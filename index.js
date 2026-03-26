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
  ActionRowBuilder
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
    GatewayIntentBits.GuildMessages
  ]
});

const QURAN_URL = 'https://server8.mp3quran.net/afs/001.mp3';

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
  'اللهم اغفر لي ذنبي كله دقه وجله وأوله وآخره',
  'اللهم إني أسألك الهدى والتقى والعفاف والغنى',
  'اللهم أصلح لي ديني الذي هو عصمة أمري',
  'اللهم أصلح لي دنياي التي فيها معاشي',
  'اللهم أصلح لي آخرتي التي إليها معادي',
  'اللهم اجعل الحياة زيادة لي في كل خير',
  'اللهم اجعل الموت راحة لي من كل شر',
  'يا حي يا قيوم برحمتك أستغيث',
  'اللهم اكفني بحلالك عن حرامك وأغنني بفضلك عمن سواك',
  'اللهم إني أعوذ بك من العجز والكسل',
  'اللهم إني أعوذ بك من الجبن والبخل',
  'اللهم إني أعوذ بك من غلبة الدين وقهر الرجال',
  'رب اغفر لي وتب علي إنك أنت التواب الرحيم',
  'ربنا آتنا من لدنك رحمة وهيئ لنا من أمرنا رشدًا',
  'رب اشرح لي صدري ويسر لي أمري',
  'رب زدني علمًا',
  'اللهم ثبت قلبي على دينك',
  'اللهم مصرف القلوب صرف قلبي على طاعتك',
  'لا إله إلا أنت سبحانك إني كنت من الظالمين',
  'أعوذ بكلمات الله التامات من شر ما خلق',
  'بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء وهو السميع العليم',
  'اللهم إني أسألك العفو والعافية في الدنيا والآخرة',
  'اللهم متعني بسمعي وبصري واجعلهما الوارث مني',
  'اللهم إني أسألك من خير ما سألك منه نبيك محمد ﷺ',
  'وأعوذ بك من شر ما استعاذ منه نبيك محمد ﷺ',
  'اللهم إني أسألك الثبات في الأمر والعزيمة على الرشد',
  'اللهم إني أسألك قلبًا سليمًا ولسانًا صادقًا',
  'اللهم اجعلني لك شاكرًا لك ذاكرًا لك راهبًا لك مطواعًا',
  'اللهم تقبل توبتي واغسل حوبتي وأجب دعوتي',
  'اللهم احفظني من بين يدي ومن خلفي وعن يميني وعن شمالي',
  'اللهم إني أعوذ بعظمتك أن أغتال من تحتي'
];

const players = new Map();

function randomZekr() {
  return adhkar[Math.floor(Math.random() * adhkar.length)];
}

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_stats (
      key TEXT PRIMARY KEY,
      value BIGINT NOT NULL DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_zekr_counts (
      user_id TEXT PRIMARY KEY,
      count BIGINT NOT NULL DEFAULT 0
    );
  `);

  await pool.query(`
    INSERT INTO bot_stats (key, value)
    VALUES ('global_zekr_total', 0)
    ON CONFLICT (key) DO NOTHING;
  `);

  console.log('✅ تم تجهيز قاعدة البيانات');
}

async function getGlobalTotal() {
  const result = await pool.query(
    'SELECT value FROM bot_stats WHERE key = $1',
    ['global_zekr_total']
  );

  if (!result.rows.length) return 0;
  return Number(result.rows[0].value || 0);
}

async function increaseGlobalTotal() {
  const result = await pool.query(
    `
      INSERT INTO bot_stats (key, value)
      VALUES ($1, 1)
      ON CONFLICT (key)
      DO UPDATE SET value = bot_stats.value + 1
      RETURNING value
    `,
    ['global_zekr_total']
  );

  return Number(result.rows[0].value || 0);
}

async function getUserCount(userId) {
  const result = await pool.query(
    'SELECT count FROM user_zekr_counts WHERE user_id = $1',
    [userId]
  );

  if (!result.rows.length) return 0;
  return Number(result.rows[0].count || 0);
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

  return Number(result.rows[0].count || 0);
}

async function createZekrEmbed(selectedZekr = randomZekr()) {
  const globalTotal = await getGlobalTotal();

  return new EmbedBuilder()
    .setColor('#0F9D9A')
    .setAuthor({ name: 'نظام الأذكار' })
    .setTitle('📿 ذكر')
    .setDescription(`╭・${selectedZekr}\n╰・اذكر الله واطمئن قلبك`)
    .addFields(
      { name: 'الفضل', value: 'الذكر نور للقلب وطمأنينة للنفس', inline: false },
      { name: 'تنبيه', value: 'أكثروا من الصلاة على النبي ﷺ', inline: false },
      { name: 'العداد العام', value: `${globalTotal}`, inline: true },
      { name: 'عدد الأذكار المتاحة', value: `${adhkar.length}`, inline: true }
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

function createEmbed({ title, description, fields = [], footer = null, image = null, thumbnail = null }) {
  const embed = new EmbedBuilder()
    .setColor('#0F9D9A')
    .setTitle(title)
    .setDescription(description || null)
    .setTimestamp();

  if (fields.length) embed.addFields(fields);
  if (footer) embed.setFooter({ text: footer });
  if (image) embed.setImage(image);
  if (thumbnail) embed.setThumbnail(thumbnail);

  return embed;
}

const commands = [
  new SlashCommandBuilder()
    .setName('zekr')
    .setDescription('يرسل ذكرًا جميلًا مع أزرار'),

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
].map(command => command.toJSON());

async function registerSlashCommands() {
  try {
    console.log('⏳ جاري تسجيل أوامر السلاش...');
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log('✅ تم تسجيل أوامر السلاش');
  } catch (error) {
    console.error('❌ خطأ في تسجيل أوامر السلاش:', error);
  }
}

function getOrCreatePlayer(guildId) {
  if (!players.has(guildId)) {
    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause
      }
    });

    player.on('error', (error) => {
      console.error('❌ خطأ في مشغل الصوت:', error.message);
    });

    player.on('stateChange', (oldState, newState) => {
      console.log(`🎵 Audio player: ${oldState.status} -> ${newState.status}`);
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

  if (!channel) {
    throw new Error('VOICE_REQUIRED');
  }

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
  console.log(`🔥 Logged in as ${client.user.tag}`);

  if (!process.env.TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
    console.error('❌ تأكد من TOKEN / CLIENT_ID / GUILD_ID');
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL غير موجود');
    return;
  }

  try {
    await initDatabase();
    console.log(`📿 العداد العام الحالي: ${await getGlobalTotal()}`);
  } catch (error) {
    console.error('❌ خطأ في تهيئة قاعدة البيانات:', error);
    return;
  }

  await registerSlashCommands();

  setInterval(async () => {
    try {
      if (!process.env.AZKAR_CHANNEL_ID) return;
      const channel = await client.channels.fetch(process.env.AZKAR_CHANNEL_ID).catch(() => null);
      if (!channel) return;

      await channel.send({
        embeds: [await createZekrEmbed()],
        components: [createZekrButtons()]
      });
    } catch (error) {
      console.error('❌ خطأ في إرسال الذكر:', error);
    }
  }, 1800000);
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
  if (interaction.isButton()) {
    if (interaction.customId === 'new_zekr') {
      try {
        return await interaction.update({
          embeds: [await createZekrEmbed()],
          components: [createZekrButtons()]
        });
      } catch (error) {
        console.error('❌ خطأ زر ذكر جديد:', error);
      }
      return;
    }

    if (interaction.customId === 'count_zekr') {
      try {
        const personalCount = await increaseUserCount(interaction.user.id);
        const totalCount = await increaseGlobalTotal();

        await interaction.update({
          embeds: [await createZekrEmbed()],
          components: [createZekrButtons()]
        });

        return await interaction.followUp({
          content: `✅ تم احتسابها لك\n📿 عدد مرات ذكرك: ${personalCount}\n🌍 العداد العام: ${totalCount}`,
          ephemeral: true
        });
      } catch (error) {
        console.error('❌ خطأ زر ذكرت:', error);
      }
      return;
    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'zekr') {
    return interaction.reply({
      embeds: [await createZekrEmbed()],
      components: [createZekrButtons()]
    });
  }

  if (interaction.commandName === 'join') {
    await interaction.deferReply({ ephemeral: true });

    try {
      await connectToVoice(interaction);
      return interaction.editReply('🎧 دخلت الروم');
    } catch (error) {
      console.error('❌ خطأ join:', error);
      return interaction.editReply('❌ ادخل روم صوتي أول');
    }
  }

  if (interaction.commandName === 'leave') {
    const connection = getVoiceConnection(interaction.guild.id);

    if (!connection) {
      return interaction.reply({
        content: '❌ مو داخل روم',
        ephemeral: true
      });
    }

    const player = players.get(interaction.guild.id);
    if (player) player.stop();

    connection.destroy();
    return interaction.reply('👋 طلعت من الروم');
  }

  if (interaction.commandName === 'quran') {
    await interaction.deferReply({ ephemeral: true });

    try {
      const connection = await connectToVoice(interaction);
      const player = getOrCreatePlayer(interaction.guild.id);

      const resource = createAudioResource(QURAN_URL, {
        inlineVolume: true
      });

      if (resource.volume) {
        resource.volume.setVolume(1);
      }

      connection.subscribe(player);
      player.play(resource);

      return interaction.editReply('📖 تم تشغيل القرآن');
    } catch (error) {
      console.error('❌ خطأ تشغيل القرآن:', error);
      return interaction.editReply('❌ صار خطأ أثناء تشغيل القرآن');
    }
  }

  if (interaction.commandName === 'stopquran') {
    const player = players.get(interaction.guild.id);

    if (!player) {
      return interaction.reply({
        content: '❌ ما فيه تشغيل حالي',
        ephemeral: true
      });
    }

    player.stop();
    return interaction.reply('⏹️ تم إيقاف القرآن');
  }

  if (interaction.commandName === 'ping') {
    const apiPing = Math.round(client.ws.ping);

    const embed = createEmbed({
      title: '🏓 سرعة البوت',
      fields: [
        { name: 'Ping', value: `\`${apiPing}ms\``, inline: true },
        { name: 'السيرفر', value: `${interaction.guild.name}`, inline: true }
      ],
      footer: 'Discord Bot'
    });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (interaction.commandName === 'avatar') {
    const user = interaction.options.getUser('user') || interaction.user;

    const embed = createEmbed({
      title: `🖼️ صورة ${user.username}`,
      image: user.displayAvatarURL({ dynamic: true, size: 1024 }),
      footer: `Requested by ${interaction.user.username}`
    });

    return interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'userinfo') {
    const user = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    const roles = member
      ? member.roles.cache
          .filter(role => role.id !== interaction.guild.id)
          .map(role => role.toString())
          .slice(0, 10)
          .join(' ، ') || 'لا توجد رتب'
      : 'غير متوفر';

    const embed = createEmbed({
      title: '👤 معلومات العضو',
      thumbnail: user.displayAvatarURL({ dynamic: true, size: 1024 }),
      fields: [
        { name: 'الاسم', value: `${user.tag}`, inline: true },
        { name: 'الآيدي', value: `${user.id}`, inline: true },
        { name: 'بوت؟', value: user.bot ? 'نعم' : 'لا', inline: true },
        { name: 'تاريخ إنشاء الحساب', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: false },
        { name: 'تاريخ دخول السيرفر', value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : 'غير متوفر', inline: false },
        { name: 'الرتب', value: roles, inline: false }
      ],
      footer: 'User Info'
    });

    return interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'server') {
    const guild = interaction.guild;

    const embed = createEmbed({
      title: '🟢 معلومات السيرفر',
      thumbnail: guild.iconURL({ dynamic: true, size: 1024 }) || null,
      fields: [
        { name: 'اسم السيرفر', value: guild.name, inline: true },
        { name: 'آيدي السيرفر', value: guild.id, inline: true },
        { name: 'المالك', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'عدد الأعضاء', value: `${guild.memberCount}`, inline: true },
        { name: 'عدد الرومات', value: `${guild.channels.cache.size}`, inline: true },
        { name: 'تاريخ الإنشاء', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false }
      ],
      footer: 'Server Info'
    });

    return interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'suggest') {
    const text = interaction.options.getString('text');

    if (!process.env.SUGGEST_CHANNEL_ID) {
      return interaction.reply({
        content: '❌ روم الاقتراحات غير مضبوط في المتغيرات',
        ephemeral: true
      });
    }

    const suggestChannel = await interaction.guild.channels.fetch(process.env.SUGGEST_CHANNEL_ID).catch(() => null);

    if (!suggestChannel) {
      return interaction.reply({
        content: '❌ ما قدرت أوصل لروم الاقتراحات',
        ephemeral: true
      });
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

    return interaction.reply({
      content: '✅ تم إرسال اقتراحك بنجاح',
      ephemeral: true
    });
  }
});

client.login(process.env.TOKEN);