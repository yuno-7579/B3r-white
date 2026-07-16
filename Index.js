const {
    Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder,
    REST, Routes, PermissionFlagsBits
} = require('discord.js');

// ✅ الإعدادات — Environment Variables (Railway)
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const WHITELIST_ROLE_ID = process.env.WHITELIST_ROLE_ID;             // رول "Whitelisted" اللي هيتحط للاعب
const APPLICATION_TEAM_ROLE_ID = process.env.APPLICATION_TEAM_ROLE_ID; // رول فريق التقديمات المسموح لهم يستخدموا الأمر
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;                    // روم اللوجز (اختياري)

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

const commands = [
    new SlashCommandBuilder()
        .setName('accept')
        .setDescription('قبول تقديم لاعب وإعطاؤه رول الـ Whitelist')
        .addUserOption(option =>
            option.setName('player')
                .setDescription('اللاعب اللي هيتقبل تقديمه')
                .setRequired(true)
        )
];

client.once('ready', async () => {
    console.log(`✅ البوت شغال: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('✅ الأوامر اتسجلت!');
    } catch (err) {
        console.error('❌ خطأ في تسجيل الأوامر:', err);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'accept') return;

    // ✅ اتأكد إن اللي بيستخدم الأمر من فريق التقديمات (أو أدمن)
    const isApplicationTeam = interaction.member.roles.cache.has(APPLICATION_TEAM_ROLE_ID);
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isApplicationTeam && !isAdmin) {
        return interaction.reply({ content: '❌ الأمر ده لفريق التقديمات بس.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('player');
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
        return interaction.reply({ content: '❌ مش لاقي اللاعب ده في السيرفر.', ephemeral: true });
    }

    // ✅ اديله الرول
    try {
        await targetMember.roles.add(WHITELIST_ROLE_ID);
    } catch (err) {
        console.error('❌ خطأ في إضافة الرول:', err);
        return interaction.reply({ content: '❌ حصل خطأ وأنا بحاول أدي الرول، تأكد إن رتبة البوت فوق رول الـ Whitelist.', ephemeral: true });
    }

    const acceptEmbed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('✅ Application Accepted')
        .setDescription(`Congratulations ${targetUser}! You have been **accepted** into B3R RP!`)
        .addFields(
            { name: '👤 Player', value: `${targetUser}`, inline: true },
            { name: '🛡️ Staff', value: `${interaction.user}`, inline: true },
            { name: '🟣 Role', value: `<@&${WHITELIST_ROLE_ID}>`, inline: true }
        )
        .setThumbnail(interaction.guild.iconURL())
        .setFooter({ text: 'B3R RP — Application System' })
        .setTimestamp();

    await interaction.reply({ embeds: [acceptEmbed] });

    if (LOG_CHANNEL_ID) {
        try {
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
            await logChannel.send({ content: `✅ <@${interaction.user.id}> قبل تقديم <@${targetUser.id}> وديله رول الـ Whitelist.` });
        } catch (err) {
            console.error('❌ خطأ في إرسال اللوج:', err);
        }
    }
});

client.login(TOKEN);