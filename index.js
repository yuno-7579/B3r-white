
const {
    Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder,
    REST, Routes, PermissionFlagsBits
} = require('discord.js');

// ✅ الإعدادات — Environment Variables (Railway)
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const WHITELIST_ROLE_ID = process.env.WHITELIST_ROLE_ID;               // رول "Whitelisted" اللي هيتحط عند القبول
const APPLICATION_TEAM_ROLE_ID = process.env.APPLICATION_TEAM_ROLE_ID; // رول فريق التقديمات المسموح لهم يستخدموا الأوامر
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;                     // روم اللوجز (اختياري)

// ✅ رولات الرفض المتدرجة
const REJECT_ROLE_1_ID = process.env.REJECT_ROLE_1_ID;           // رفض أول مرة
const REJECT_ROLE_2_ID = process.env.REJECT_ROLE_2_ID;           // رفض تاني مرة
const REJECT_PERMANENT_ROLE_ID = process.env.REJECT_PERMANENT_ROLE_ID; // رفض دائم (بعد 3 مرات)

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
        ),
    new SlashCommandBuilder()
        .setName('reject')
        .setDescription('رفض تقديم لاعب')
        .addUserOption(option =>
            option.setName('player')
                .setDescription('اللاعب اللي هيترفض تقديمه')
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

function isStaff(interaction) {
    const isApplicationTeam = interaction.member.roles.cache.has(APPLICATION_TEAM_ROLE_ID);
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    return isApplicationTeam || isAdmin;
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // ─── /accept ──────────────────────────────
    if (interaction.commandName === 'accept') {
        if (!isStaff(interaction)) {
            return interaction.reply({ content: '❌ الأمر ده لفريق التقديمات بس.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('player');
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            return interaction.reply({ content: '❌ مش لاقي اللاعب ده في السيرفر.', ephemeral: true });
        }

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
                { name: '🟢 Role', value: `<@&${WHITELIST_ROLE_ID}>`, inline: true }
            )
            .setThumbnail(interaction.guild.iconURL())
            .setFooter({ text: 'B3R RP — Application System' })
            .setTimestamp();

        await interaction.reply({ embeds: [acceptEmbed] });

        // ✅ رسالة تهنئة في الخاص
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🎉 مبروك، تم قبولك في B3R RP!')
                .setDescription('تقديمك اتقبل، وانت جاهز تدخل السيرفر في أي وقت. متشرفين بيك معانا! 🟣')
                .setFooter({ text: 'B3R RP — Application System' })
                .setTimestamp();
            await targetUser.send({ embeds: [dmEmbed] });
        } catch (err) {
            console.log('⚠️ متقدرش يبعت رسالة خاصة للاعب (ممكن يكون قافل الخاص).');
        }

        if (LOG_CHANNEL_ID) {
            try {
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                await logChannel.send({ content: `✅ <@${interaction.user.id}> قبل تقديم <@${targetUser.id}> وديله رول الـ Whitelist.` });
            } catch (err) {
                console.error('❌ خطأ في إرسال اللوج:', err);
            }
        }
        return;
    }

    // ─── /reject ──────────────────────────────
    if (interaction.commandName === 'reject') {
        if (!isStaff(interaction)) {
            return interaction.reply({ content: '❌ الأمر ده لفريق التقديمات بس.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('player');
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            return interaction.reply({ content: '❌ مش لاقي اللاعب ده في السيرفر.', ephemeral: true });
        }

        const hasReject1 = targetMember.roles.cache.has(REJECT_ROLE_1_ID);
        const hasReject2 = targetMember.roles.cache.has(REJECT_ROLE_2_ID);

        let rejectStage = 1;
        let dmDescription = 'للأسف تم رفض تقديمك. تقدر تنتظر وتتقدم تاني لمقابلة صوتية جديدة قريبًا.';
        let logStage = 'رفض أول مرة';

        try {
            if (hasReject2) {
                rejectStage = 3;
                await targetMember.roles.remove(REJECT_ROLE_2_ID).catch(() => {});
                await targetMember.roles.add(REJECT_PERMANENT_ROLE_ID);
                dmDescription = 'للأسف وصلت لعدد المحاولات المسموح بيها، وتم رفض تقديمك بشكل **دائم**. مينفعش تتقدم تاني بعد كده.';
                logStage = 'رفض دائم (تالت مرة)';
            } else if (hasReject1) {
                rejectStage = 2;
                await targetMember.roles.remove(REJECT_ROLE_1_ID).catch(() => {});
                await targetMember.roles.add(REJECT_ROLE_2_ID);
                dmDescription = 'للأسف تم رفض تقديمك مرة تانية. تقدر تنتظر وتتقدم تاني لمقابلة صوتية جديدة قريبًا، بس خد بالك المرة الجاية آخر فرصة.';
                logStage = 'رفض تاني مرة';
            } else {
                rejectStage = 1;
                await targetMember.roles.add(REJECT_ROLE_1_ID);
            }
        } catch (err) {
            console.error('❌ خطأ في تعديل رولات الرفض:', err);
            return interaction.reply({ content: '❌ حصل خطأ وأنا بحاول أعدل الرولات، تأكد إن رتبة البوت فوق رولات الرفض.', ephemeral: true });
        }

        const rejectEmbed = new EmbedBuilder()
            .setColor(rejectStage === 3 ? '#7f0000' : '#e74c3c')
            .setTitle(rejectStage === 3 ? '⛔ Application Permanently Rejected' : '❌ Application Rejected')
            .setDescription(`${targetUser}, ${rejectStage === 3 ? 'تم رفض تقديمك بشكل دائم.' : 'للأسف تم رفض تقديمك، وتقدر تحاول تاني قريبًا.'}`)
            .addFields(
                { name: '👤 Player', value: `${targetUser}`, inline: true },
                { name: '🛡️ Staff', value: `${interaction.user}`, inline: true },
                { name: '📊 Stage', value: `${rejectStage}/3`, inline: true }
            )
            .setThumbnail(interaction.guild.iconURL())
            .setFooter({ text: 'B3R RP — Application System' })
            .setTimestamp();

        await interaction.reply({ embeds: [rejectEmbed] });

        // ✅ رسالة في الخاص
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor(rejectStage === 3 ? '#7f0000' : '#e74c3c')
                .setTitle(rejectStage === 3 ? '⛔ رفض دائم' : '❌ تم رفض تقديمك')
                .setDescription(dmDescription)
                .setFooter({ text: 'B3R RP — Application System' })
                .setTimestamp();
            await targetUser.send({ embeds: [dmEmbed] });
        } catch (err) {
            console.log('⚠️ متقدرش يبعت رسالة خاصة للاعب (ممكن يكون قافل الخاص).');
        }

        if (LOG_CHANNEL_ID) {
            try {
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                await logChannel.send({ content: `❌ <@${interaction.user.id}> رفض تقديم <@${targetUser.id}> — ${logStage}.` });
            } catch (err) {
                console.error('❌ خطأ في إرسال اللوج:', err);
            }
        }
        return;
    }
});

client.login(TOKEN);
