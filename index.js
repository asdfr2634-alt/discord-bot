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
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

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
  'أستغفر الله العظيم وأتوب إليه',
  'لا حول ولا قوة إلا بالله',
  'اللهم صل وسلم على نبينا محمد',
  'حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم',
  'اللهم اغفر لي ولوالدي وللمؤمنين والمؤمنات',
  'اللهم إنك عفو تحب العفو فاعفُ عني',
  'اللهم آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار',
  'اللهم إني أسألك الجنة وأعوذ بك من النار',
  'اللهم أصلح لي ديني الذي هو عصمة أمري',
  'اللهم اجعل القرآن ربيع قلبي ونور صدري',
  'اللهم إني أعوذ بك من الهم والحزن',
  'اللهم إني أعوذ بك من العجز والكسل',
  'اللهم إني أعوذ بك من الجبن والبخل',
  'اللهم إني أعوذ بك من غلبة الدين وقهر الرجال',
  'اللهم إني أعوذ بك من زوال نعمتك',
  'اللهم إني أعوذ بك من فجأة نقمتك',
  'اللهم إني أعوذ بك من جميع سخطك',
  'اللهم إني أسألك العفو والعافية',
  'اللهم إني أسألك العافية في الدنيا والآخرة',
  'اللهم اهدني وسددني',
  'اللهم ثبت قلبي على دينك',
  'اللهم يا مقلب القلوب ثبت قلبي على طاعتك',
  'اللهم ارزقني حسن الخاتمة',
  'اللهم اجعلني من التوابين',
  'اللهم اجعلني من المتطهرين',
  'اللهم ارزقني الإخلاص في القول والعمل',
  'اللهم تقبل مني إنك أنت السميع العليم',
  'اللهم اغفر ذنبي كله دقه وجله',
  'اللهم اغفر لي ما قدمت وما أخرت',
  'اللهم اغفر لي ما أسررت وما أعلنت',
  'اللهم اغفر لي ما أنت أعلم به مني',
  'اللهم إني ظلمت نفسي ظلماً كثيراً',
  'فاغفر لي فإنه لا يغفر الذنوب إلا أنت',
  'رب اغفر لي ولوالدي',
  'رب ارحمهما كما ربياني صغيراً',
  'رب اجعلني مقيم الصلاة ومن ذريتي',
  'ربنا تقبل منا إنك أنت السميع العليم',
  'ربنا لا تزغ قلوبنا بعد إذ هديتنا',
  'ربنا آتنا من لدنك رحمة',
  'ربنا هب لنا من أزواجنا وذرياتنا قرة أعين',
  'واجعلنا للمتقين إماماً',
  'اللهم اجعلنا من أهل الجنة',
  'اللهم جنبنا النار',
  'اللهم إنا نعوذ بك من عذاب القبر',
  'اللهم إنا نعوذ بك من عذاب النار',
  'اللهم إنا نعوذ بك من فتنة المحيا والممات',
  'اللهم إنا نعوذ بك من فتنة المسيح الدجال',
  'اللهم ارزقنا الفردوس الأعلى',
  'اللهم اسقنا من يد نبيك شربة لا نظمأ بعدها أبداً'
];

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
    const channel = interaction.member.voice.channel;

    if (!channel) {
      return interaction.reply({
        content: '❌ ادخل روم صوتي أول',
        ephemeral: true
      });
    }

    joinVoiceChannel({
      channelId: channel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator
    });

    return interaction.reply('🎧 دخلت الروم');
  }

  if (interaction.commandName === 'leave') {
    const connection = getVoiceConnection(interaction.guild.id);

    if (!connection) {
      return interaction.reply({
        content: '❌ مو داخل روم',
        ephemeral: true
      });
    }

    connection.destroy();
    return interaction.reply('👋 طلعت من الروم');
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      return interaction.reply({
        content: '❌ صار خطأ أثناء حذف الرسائل',
        ephemeral: true
      });
    }
  }
});

client.login(process.env.TOKEN);