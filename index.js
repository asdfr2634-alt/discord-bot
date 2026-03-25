require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
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
  StreamType
} = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const adhkar = [
  'سبحان الله',
  'الحمد لله',
  'لا إله إلا الله',
  'الله أكبر',
  'سبحان الله وبحمده',
  'سبحان الله العظيم',
  'أستغفر الله',
  'لا حول ولا قوة إلا بالله',
  'اللهم صل وسلم على نبينا محمد',
  'حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم',
  'اللهم اغفر لي ولوالدي وللمؤمنين والمؤمنات',
  'اللهم إنك عفو تحب العفو فاعفُ عني'
];

// رابط قرآن مباشر
const QURAN_URL = 'https://download.quranicaudio.com/qdc/mishari_al_afasy/murattal/001.mp3';

function randomZekr() {
  return adhkar[Math.floor(Math.random() * adhkar.length)];
}

function createZekrEmbed() {
  return new EmbedBuilder()
    .setColor('#2F3136')
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
    .setName('ban')
    .setDescription('حظر عضو')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('العضو')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('سبب الحظر')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('طرد عضو')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('العضو')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('سبب الطرد')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('إعطاء ميوت مؤقت لعضو')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('العضو')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('minutes')
        .setDescription('مدة الميوت بالدقائق')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('سبب الميوت')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('حذف عدد من الرسائل')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('عدد الرسائل')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
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
    adapterCreator: interaction.guild.voiceAdapterCreator
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
  return connection;
}

client.once('ready', async () => {
  console.log(`🔥 Logged in as ${client.user.tag}`);
  await registerSlashCommands();

  setInterval(async () => {
    try {
      const channel = await client.channels.fetch(process.env.AZKAR_CHANNEL_ID);
      if (!channel) return;
      await channel.send({ embeds: [createZekrEmbed()] });
    } catch (error) {
      console.error('❌ خطأ في إرسال الذكر:', error);
    }
  }, 1800000);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'zekr') {
    return interaction.reply({ embeds: [createZekrEmbed()] });
  }

  if (interaction.commandName === 'join') {
    try {
      await connectToVoice(interaction);
      return interaction.reply('🎧 دخلت الروم');
    } catch {
      return interaction.reply({ content: '❌ ادخل روم صوتي أول', ephemeral: true });
    }
  }

  if (interaction.commandName === 'leave') {
    const connection = getVoiceConnection(interaction.guild.id);

    if (!connection) {
      return interaction.reply({ content: '❌ مو داخل روم', ephemeral: true });
    }

    const player = players.get(interaction.guild.id);
    if (player) player.stop();

    connection.destroy();
    return interaction.reply('👋 طلعت من الروم');
  }

  if (interaction.commandName === 'quran') {
    try {
      const connection = await connectToVoice(interaction);
      const player = getOrCreatePlayer(interaction.guild.id);

      const resource = createAudioResource(QURAN_URL, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true
      });

      if (resource.volume) {
        resource.volume.setVolume(0.5);
      }

      connection.subscribe(player);
      player.play(resource);

      return interaction.reply('📖 تم تشغيل القرآن');
    } catch (error) {
      console.error('❌ خطأ تشغيل القرآن:', error);

      if (error.message === 'VOICE_REQUIRED') {
        return interaction.reply({ content: '❌ ادخل روم صوتي أول', ephemeral: true });
      }

      return interaction.reply({ content: '❌ صار خطأ أثناء تشغيل القرآن', ephemeral: true });
    }
  }

  if (interaction.commandName === 'stopquran') {
    const player = players.get(interaction.guild.id);

    if (!player) {
      return interaction.reply({ content: '❌ ما فيه تشغيل حالي', ephemeral: true });
    }

    player.stop();
    return interaction.reply('⏹️ تم إيقاف القرآن');
  }

  if (interaction.commandName === 'ban') {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'بدون سبب';

    try {
      const member = await interaction.guild.members.fetch(user.id);

      if (!member.bannable) {
        return interaction.reply({
          content: '❌ ما أقدر أحظر هذا العضو',
          ephemeral: true
        });
      }

      await member.ban({ reason });
      return interaction.reply(`🚫 تم حظر ${user.tag}\nالسبب: ${reason}`);
    } catch {
      return interaction.reply({
        content: '❌ صار خطأ أثناء الحظر',
        ephemeral: true
      });
    }
  }

  if (interaction.commandName === 'kick') {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'بدون سبب';

    try {
      const member = await interaction.guild.members.fetch(user.id);

      if (!member.kickable) {
        return interaction.reply({
          content: '❌ ما أقدر أطرد هذا العضو',
          ephemeral: true
        });
      }

      await member.kick(reason);
      return interaction.reply(`👢 تم طرد ${user.tag}\nالسبب: ${reason}`);
    } catch {
      return interaction.reply({
        content: '❌ صار خطأ أثناء الطرد',
        ephemeral: true
      });
    }
  }

  if (interaction.commandName === 'timeout') {
    const user = interaction.options.getUser('user');
    const minutes = interaction.options.getInteger('minutes');
    const reason = interaction.options.getString('reason') || 'بدون سبب';

    try {
      const member = await interaction.guild.members.fetch(user.id);

      if (!member.moderatable) {
        return interaction.reply({
          content: '❌ ما أقدر أعطي ميوت لهذا العضو',
          ephemeral: true
        });
      }

      await member.timeout(minutes * 60 * 1000, reason);
      return interaction.reply(`⏳ تم إعطاء ميوت لـ ${user.tag} لمدة ${minutes} دقيقة\nالسبب: ${reason}`);
    } catch {
      return interaction.reply({
        content: '❌ صار خطأ أثناء إعطاء الميوت',
        ephemeral: true
      });
    }
  }

  if (interaction.commandName === 'clear') {
    const amount = interaction.options.getInteger('amount');

    if (amount < 1 || amount > 100) {
      return interaction.reply({
        content: '❌ لازم يكون العدد بين 1 و 100',
        ephemeral: true
      });
    }

    try {
      await interaction.channel.bulkDelete(amount, true);
      return interaction.reply({
        content: `🧹 تم حذف ${amount} رسالة`,
        ephemeral: true
      });
    } catch {
      return interaction.reply({
        content: '❌ صار خطأ أثناء حذف الرسائل',
        ephemeral: true
      });
    }
  }
});

client.login(process.env.TOKEN);