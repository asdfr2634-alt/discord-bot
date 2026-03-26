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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

const QURAN_URL = 'https://server8.mp3quran.net/afs/001.mp3';

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
  'اللهم ارزقني حسن الخاتمة'
];

function randomZekr() {
  return adhkar[Math.floor(Math.random() * adhkar.length)];
}

function createZekrEmbed() {
  return new EmbedBuilder()
    .setColor('#0F9D9A')
    .setAuthor({ name: 'نظام الأذكار' })
    .setTitle('📿 ذكر')
    .setDescription(`╭・${randomZekr()}\n╰・اذكر الله واطمئن قلبك`)
    .addFields(
      { name: 'الفضل', value: 'الذكر نور للقلب وطمأنينة للنفس', inline: false },
      { name: 'تنبيه', value: 'أكثروا من الصلاة على النبي ﷺ', inline: false }
    )
    .setFooter({ text: 'أذكار تلقائية • Discord Bot' })
    .setTimestamp();
}

function createZekrButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('new_zekr')
      .setLabel('ذكر جديد')
      .setEmoji('📿')
      .setStyle(ButtonStyle.Primary)
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
    .setDescription('يرسل ذكرًا جميلًا'),

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
      option
        .setName('user')
        .setDescription('العضو المطلوب')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('يعرض معلومات العضو')
    .addUserOption(option =>
      option
        .setName('user')
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
      option
        .setName('text')
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

const players = new Map();

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

client.once('ready', async () => {
  console.log(`🔥 Logged in as ${client.user.tag}`);

  if (!process.env.TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
    console.error('❌ تأكد من متغيرات البيئة: TOKEN / CLIENT_ID / GUILD_ID');
    return;
  }

  await registerSlashCommands();

  setInterval(async () => {
    try {
      if (!process.env.AZKAR_CHANNEL_ID) return;
      const channel = await client.channels.fetch(process.env.AZKAR_CHANNEL_ID).catch(() => null);
      if (!channel) return;
      await channel.send({
        embeds: [createZekrEmbed()],
        components: [createZekrButtonRow()]
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
          embeds: [createZekrEmbed()],
          components: [createZekrButtonRow()]
        });
      } catch (error) {
        console.error('❌ خطأ زر الذكر الجديد:', error);
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'zekr') {
    return interaction.reply({
      embeds: [createZekrEmbed()],
      components: [createZekrButtonRow()]
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