const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Connectors } = require('shoukaku');
const { Kazagumo } = require('kazagumo');
const express = require('express');
require('dotenv').config();

// ============ BOT INFO ============
const BOT_INFO = {
    name: 'Melodify',
    version: '1.0.0',
    color: '#5865F2'
};

// ============ EXPRESS ============
const app = express();
app.get('/', (req, res) => res.json({ status: 'online', bot: BOT_INFO.name }));
app.get('/ping', (req, res) => res.send('OK'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Server ready'));

// ============ CLIENT ============
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ============ LAVALINK NODES (OPTIMIZED - V4 ONLY) ============
const Nodes = [
    // ⭐ Primary - SerenetiaV4 (100% uptime)
    {
        name: 'Main',
        url: 'lavalinkv4.serenetia.com:443',
        auth: 'https://dsc.gg/ajidevserver',
        secure: true
    },
    // Backup 1
    {
        name: 'Backup1',
        url: 'lava-v4.ajieblogs.eu.org:443',
        auth: 'https://dsc.gg/ajidevserver',
        secure: true
    },
    // Backup 2 - Personal Render (jika ada)
    {
        name: 'MyServer',
        url: process.env.LAVALINK_HOST || 'lavalink-sf9r.onrender.com:443',
        auth: process.env.LAVALINK_PASSWORD || 'your_password',
        secure: true
    }
];

// ============ KAZAGUMO (SIMPLE & FAST) ============
const kazagumo = new Kazagumo(
    {
        defaultSearchEngine: 'youtube',
        send: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) guild.shard.send(payload);
        }
    },
    new Connectors.DiscordJS(client),
    Nodes,
    {
        moveOnDisconnect: false,
        resumable: false,        // ✅ Faster startup
        reconnectTries: 3,       // ✅ Reasonable
        restTimeout: 15000       // ✅ 15 seconds
    }
);

// ============ LAVALINK EVENTS ============
kazagumo.shoukaku.on('ready', (name) => console.log(`✅ [${name}] Connected!`));
kazagumo.shoukaku.on('error', (name, err) => console.log(`❌ [${name}] Error: ${err.message}`));
kazagumo.shoukaku.on('disconnect', (name) => console.log(`⚠️ [${name}] Disconnected`));

// ============ PLAYER EVENTS ============
kazagumo.on('playerStart', (player, track) => {
    const ch = client.channels.cache.get(player.textId);
    if (!ch) return;

    const embed = new EmbedBuilder()
        .setColor(BOT_INFO.color)
        .setAuthor({ name: '🎵 Now Playing', iconURL: client.user.displayAvatarURL() })
        .setTitle(track.title)
        .setURL(track.uri)
        .setThumbnail(track.thumbnail || null)
        .addFields(
            { name: 'Duration', value: formatDuration(track.length), inline: true },
            { name: 'Author', value: track.author || 'Unknown', inline: true },
            { name: 'Requested', value: `${track.requester}`, inline: true }
        )
        .setTimestamp();

    ch.send({ embeds: [embed] });
});

kazagumo.on('playerEmpty', (player) => {
    const ch = client.channels.cache.get(player.textId);
    if (ch) ch.send({ embeds: [new EmbedBuilder().setColor('#ff6b6b').setDescription('⏹️ Queue finished!')] });
    player.destroy();
});

kazagumo.on('playerError', (player, err) => {
    console.log('Player error:', err);
    const ch = client.channels.cache.get(player.textId);
    if (ch) ch.send({ embeds: [errorEmbed('Error playing track, skipping...')] });
});

// ============ BOT READY ============
client.once('ready', () => {
    console.log('═'.repeat(40));
    console.log(`🤖 ${client.user.tag} online!`);
    console.log(`📊 ${client.guilds.cache.size} servers`);
    console.log('═'.repeat(40));
    client.user.setActivity('!help | Music', { type: 2 });
});

// ============ HELPERS ============
function formatDuration(ms) {
    if (!ms || ms === 0) return '🔴 Live';
    const s = Math.floor((ms / 1000) % 60);
    const m = Math.floor((ms / (1000 * 60)) % 60);
    const h = Math.floor(ms / (1000 * 60 * 60));
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
}

function errorEmbed(msg) {
    return new EmbedBuilder().setColor('#ff6b6b').setDescription(`❌ ${msg}`);
}

function successEmbed(msg) {
    return new EmbedBuilder().setColor(BOT_INFO.color).setDescription(msg);
}

function getNodeStatus() {
    const result = [];
    kazagumo.shoukaku.nodes.forEach((node, name) => {
        result.push({
            name,
            online: node.state === 2,
            players: node.stats?.players || 0
        });
    });
    return result;
}

// ============ COMMANDS ============
client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.content.startsWith('!')) return;
    
    const args = msg.content.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    // ==================== PLAY ====================
    if (cmd === 'play' || cmd === 'p') {
        if (!msg.member.voice.channel) {
            return msg.reply({ embeds: [errorEmbed('Join voice channel dulu!')] });
        }

        const query = args.join(' ');
        if (!query) {
            return msg.reply({ embeds: [errorEmbed('Usage: `!play <song>`')] });
        }

        try {
            let player = kazagumo.players.get(msg.guild.id);

            if (!player) {
                player = await kazagumo.createPlayer({
                    guildId: msg.guild.id,
                    textId: msg.channel.id,
                    voiceId: msg.member.voice.channel.id,
                    volume: 70,
                    deaf: true
                });
            }

            const result = await kazagumo.search(query, { requester: msg.author });

            if (!result?.tracks?.length) {
                return msg.reply({ embeds: [errorEmbed('Not found!')] });
            }

            if (result.type === 'PLAYLIST') {
                for (const track of result.tracks) player.queue.add(track);
                msg.channel.send({ embeds: [successEmbed(`📃 Added **${result.tracks.length}** tracks from **${result.playlistName}**`)] });
            } else {
                const track = result.tracks[0];
                player.queue.add(track);
                if (player.playing || player.paused) {
                    msg.channel.send({ embeds: [successEmbed(`➕ Added: **${track.title}**`)] });
                }
            }

            if (!player.playing && !player.paused) player.play();

        } catch (error) {
            console.error('Play error:', error);
            msg.reply({ embeds: [errorEmbed(`Error: ${error.message}`)] });
        }
    }

    // ==================== SKIP ====================
    if (cmd === 'skip' || cmd === 's') {
        const player = kazagumo.players.get(msg.guild.id);
        if (!player?.queue.current) return msg.reply({ embeds: [errorEmbed('Nothing to skip!')] });
        player.skip();
        msg.react('⏭️');
    }

    // ==================== STOP ====================
    if (cmd === 'stop' || cmd === 'dc' || cmd === 'leave') {
        const player = kazagumo.players.get(msg.guild.id);
        if (!player) return msg.reply({ embeds: [errorEmbed('Nothing playing!')] });
        player.destroy();
        msg.react('⏹️');
    }

    // ==================== PAUSE / RESUME ====================
    if (cmd === 'pause') {
        const player = kazagumo.players.get(msg.guild.id);
        if (player) { player.pause(true); msg.react('⏸️'); }
    }

    if (cmd === 'resume') {
        const player = kazagumo.players.get(msg.guild.id);
        if (player) { player.pause(false); msg.react('▶️'); }
    }

    // ==================== QUEUE ====================
    if (cmd === 'queue' || cmd === 'q') {
        const player = kazagumo.players.get(msg.guild.id);
        if (!player?.queue.current) return msg.reply({ embeds: [errorEmbed('Queue empty!')] });

        const current = player.queue.current;
        let desc = `**Now:** [${current.title}](${current.uri})\n\n`;

        if (player.queue.length > 0) {
            desc += `**Up Next:**\n`;
            player.queue.slice(0, 10).forEach((t, i) => {
                desc += `\`${i + 1}.\` ${t.title}\n`;
            });
            if (player.queue.length > 10) desc += `\n*+${player.queue.length - 10} more*`;
        }

        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.color)
            .setAuthor({ name: `Queue • ${msg.guild.name}` })
            .setDescription(desc)
            .setFooter({ text: `${player.queue.length + 1} tracks` });

        msg.channel.send({ embeds: [embed] });
    }

    // ==================== NOW PLAYING ====================
    if (cmd === 'np' || cmd === 'nowplaying') {
        const player = kazagumo.players.get(msg.guild.id);
        if (!player?.queue.current) return msg.reply({ embeds: [errorEmbed('Nothing playing!')] });

        const t = player.queue.current;
        const pos = player.position;
        const dur = t.length;
        const progress = dur ? Math.round((pos / dur) * 15) : 0;
        const bar = '▬'.repeat(progress) + '🔘' + '▬'.repeat(15 - progress);

        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.color)
            .setTitle(t.title)
            .setURL(t.uri)
            .setThumbnail(t.thumbnail)
            .setDescription(`\`${formatDuration(pos)}\` ${bar} \`${formatDuration(dur)}\``)
            .addFields(
                { name: 'Author', value: t.author || 'Unknown', inline: true },
                { name: 'Volume', value: `${player.volume}%`, inline: true }
            );

        msg.channel.send({ embeds: [embed] });
    }

    // ==================== VOLUME ====================
    if (cmd === 'vol' || cmd === 'volume') {
        const player = kazagumo.players.get(msg.guild.id);
        if (!player) return msg.reply({ embeds: [errorEmbed('Nothing playing!')] });

        if (!args[0]) return msg.channel.send({ embeds: [successEmbed(`🔊 Volume: **${player.volume}%**`)] });

        const vol = parseInt(args[0]);
        if (isNaN(vol) || vol < 0 || vol > 100) return msg.reply({ embeds: [errorEmbed('0-100 only!')] });

        player.setVolume(vol);
        msg.channel.send({ embeds: [successEmbed(`🔊 Volume: **${vol}%**`)] });
    }

    // ==================== LOOP ====================
    if (cmd === 'loop') {
        const player = kazagumo.players.get(msg.guild.id);
        if (!player) return msg.reply({ embeds: [errorEmbed('Nothing playing!')] });

        const mode = args[0]?.toLowerCase();
        if (!['track', 'queue', 'off'].includes(mode)) {
            return msg.reply({ embeds: [errorEmbed('Usage: `!loop track/queue/off`')] });
        }

        player.setLoop(mode === 'off' ? 'none' : mode);
        msg.channel.send({ embeds: [successEmbed(`🔁 Loop: **${mode}**`)] });
    }

    // ==================== NODES ====================
    if (cmd === 'nodes') {
        const nodes = getNodeStatus();
        let text = '**📡 Lavalink Nodes:**\n\n';
        nodes.forEach(n => {
            text += `${n.online ? '🟢' : '🔴'} **${n.name}** - Players: ${n.players}\n`;
        });
        text += `\n**Online:** ${nodes.filter(n => n.online).length}/${nodes.length}`;
        msg.reply(text);
    }

    // ==================== PING ====================
    if (cmd === 'ping') {
        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.color)
            .setDescription(`🏓 **Pong!** \`${Date.now() - msg.createdTimestamp}ms\` | API: \`${client.ws.ping}ms\``);
        msg.channel.send({ embeds: [embed] });
    }

    // ==================== HELP ====================
    if (cmd === 'help') {
        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.color)
            .setAuthor({ name: BOT_INFO.name, iconURL: client.user.displayAvatarURL() })
            .addFields(
                { name: '🎵 Music', value: '`!play` `!skip` `!stop` `!pause` `!resume`', inline: false },
                { name: '📋 Queue', value: '`!queue` `!np` `!loop`', inline: false },
                { name: '🎛️ Control', value: '`!vol` `!nodes` `!ping`', inline: false }
            )
            .setTimestamp();
        msg.channel.send({ embeds: [embed] });
    }
});

// ============ ERROR HANDLING ============
process.on('unhandledRejection', (err) => console.error('Unhandled:', err));

// ============ LOGIN ============
client.login(process.env.DISCORD_TOKEN);
