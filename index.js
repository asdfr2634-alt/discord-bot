require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
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

function randomZekr() {
  return adhkar[Math.floor(Math.random() * adhkar.length)];
}

function createZekrEmbed() {
  return new EmbedBuilder()
    .setColor('#2F3136')
    .setAuthor({
      name: 'نظام الأذكار'
    })
    .setTitle('📿 ذكر')
    .setDescription(`╭・${randomZekr()}\n╰・اذكر الله واطمئن قلبك`)
    .addFields(
      { name: 'الفضل', value: 'الذكر نور للقلب وطمأنينة للنفس', inline: false },
      { name: 'تنبيه', value: 'أكثروا من الصلاة على النبي ﷺ', inline: false }
    )
    .setFooter({ text: 'أذكار تلقائية • Time Dosn' })
    .setTimestamp();
}

client.once('ready', async () => {
  console.log(`🔥 Logged in as ${client.user.tag}`);

  setInterval(async () => {
    try {
      const channel = await client.channels.fetch(process.env.AZKAR_CHANNEL_ID);
      if (!channel) return;

      await channel.send({ embeds: [createZekrEmbed()] });
    } catch (error) {
      console.error('خطأ في إرسال الذكر:', error);
    }
  }, 1800000);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!ذكر') {
    await message.channel.send({ embeds: [createZekrEmbed()] });
  }

  if (message.content === '!join') {
    const channel = message.member?.voice?.channel;

    if (!channel) {
      return message.reply('❌ ادخل روم صوتي أول');
    }

    joinVoiceChannel({
      channelId: channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator
    });

    return message.reply('🎧 دخلت الروم');
  }

  if (message.content === '!leave') {
    const connection = getVoiceConnection(message.guild.id);

    if (!connection) {
      return message.reply('❌ مو داخل روم');
    }

    connection.destroy();
    return message.reply('👋 طلعت من الروم');
  }
});

client.login(process.env.TOKEN);