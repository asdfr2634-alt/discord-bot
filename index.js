require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder
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
    GatewayIntentBits.GuildVoiceStates
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
    .setDescription('يوقف تشغيل القرآن')
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
});

client.login(process.env.TOKEN);