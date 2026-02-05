const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { Connectors } = require('shoukaku');
const { Kazagumo } = require('kazagumo');
const express = require('express');
require('dotenv').config();

// ============ BOT INFO ============
const BOT_INFO = {
    name: 'Melodify',
    version: '1.0.1',
    description: 'Bot musik Discord berkualitas tinggi.',
    owner: { id: '1307489983359357019', username: 'demisz_dc', display: 'Demisz' },
    color: '#5865F2'
};

// ============ EXPRESS SERVER ============
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.status(200).send('🎵 Melodify Bot is running!'));
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

// ============ DISCORD CLIENT ============
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ============ LAVALINK NODES (TOP 3 UPTIME TERBAIK) ============
const Nodes = [
    {
        name: 'Serenetia-V4-SSL',
        url: 'lavalinkv4.serenetia.com:443',
        auth: 'https://dsc.gg/ajidevserver',
        secure: true
    },
    {
        name: 'Serenetia-V4',
        url: 'lavalinkv4.serenetia.com:80',
        auth: 'https://dsc.gg/ajidevserver',
        secure: false
    },
    {
        name: 'TechByte',
        url: 'lavahatry4.techbyte.host:3000',
        auth: 'naig.is-a.dev',
        secure: false
    }
];

// ============ KAZAGUMO SETUP ============
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
        resumable: false, 
        reconnectTries: 3, 
        restTimeout: 15000,
        reconnectInterval: 5
    }
);

// ============ HELPER FUNCTIONS ============
function formatDuration(ms) {
    if (!ms || ms === 0) return '🔴 Live';
    const s = Math.floor((ms / 1000) % 60);
    const m = Math.floor((ms / (1000 * 60)) % 60);
    const h = Math.floor(ms / (1000 * 60 * 60));
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
}

function errorEmbed(message) {
    return new EmbedBuilder().setColor('#ff6b6b').setDescription(`❌ ${message}`);
}

function successEmbed(message) {
    return new EmbedBuilder().setColor(BOT_INFO.color).setDescription(message);
}

// ============ LAVALINK NODE EVENTS ============
kazagumo.shoukaku.on('ready', (name) => {
    console.log(`✅ Lavalink ${name} connected!`);
});

kazagumo.shoukaku.on('error', (name, error) => {
    console.error(`❌ Lavalink ${name} error:`, error.message);
});

kazagumo.shoukaku.on('close', (name, code, reason) => {
    console.warn(`⚠️ Lavalink ${name} closed: ${code} - ${reason}`);
});

kazagumo.shoukaku.on('disconnect', (name, reason) => {
    console.warn(`🔌 Lavalink ${name} disconnected:`, reason);
    
    const connectedNodes = Array.from(kazagumo.shoukaku.nodes.values()).filter(n => n.state === 2);
    
    if (connectedNodes.length === 0) {
        console.error('❌ ALL NODES DISCONNECTED! Music playback unavailable!');
    } else {
        console.log(`✅ Still have ${connectedNodes.length} node(s) connected`);
    }
});

// ============ PLAYER EVENTS - IMPROVED ERROR HANDLING ============
const disconnectTimers = new Map();

kazagumo.on('playerStart', (player, track) => {
    // Clear disconnect timer jika ada
    if (disconnectTimers.has(player.guildId)) {
        clearTimeout(disconnectTimers.get(player.guildId));
        disconnectTimers.delete(player.guildId);
    }

    const channel = client.channels.cache.get(player.textId);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor(BOT_INFO.color)
        .setAuthor({ name: 'Now Playing 🎵', iconURL: client.user.displayAvatarURL() })
        .setTitle(track.title)
        .setURL(track.uri)
        .setThumbnail(track.thumbnail || null)
        .addFields(
            { name: 'Duration', value: formatDuration(track.length), inline: true },
            { name: 'Author', value: track.author || 'Unknown', inline: true },
            { name: 'Requested by', value: `${track.requester}`, inline: true }
        )
        .setFooter({ text: `Volume: ${player.volume}%  •  ${BOT_INFO.name} v${BOT_INFO.version}` })
        .setTimestamp();

    channel.send({ embeds: [embed] });
    console.log(`▶️ Playing: ${track.title} in ${player.guildId}`);
});

kazagumo.on('playerEmpty', (player) => {
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setDescription('⏸️ Queue finished. Use `!play` to add more songs.\n*Bot will leave in 2 minutes if no songs are added.*')
            .setTimestamp();
        channel.send({ embeds: [embed] });
    }
    
    console.log(`⏸️ Queue empty for guild ${player.guildId}, setting disconnect timer...`);
    
    // Set timer 2 menit sebelum disconnect
    const timer = setTimeout(() => {
        if (player && !player.queue.current && player.queue.length === 0) {
            console.log(`⏹️ Disconnecting from guild ${player.guildId} due to inactivity`);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setDescription('⏹️ Left voice channel due to inactivity.')
                    .setTimestamp();
                channel.send({ embeds: [embed] });
            }
            player.destroy();
        }
        disconnectTimers.delete(player.guildId);
    }, 120000); // 2 menit
    
    disconnectTimers.set(player.guildId, timer);
});

kazagumo.on('playerError', (player, error) => {
    console.error('❌ Player error:', error);
    const channel = client.channels.cache.get(player.textId);
    
    if (channel) {
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setDescription(`❌ Failed to play track!\n**Error:** ${error.message || 'Unknown error'}\n${player.queue.length > 0 ? '⏭️ Skipping to next track...' : ''}`)
            .setTimestamp();
        channel.send({ embeds: [embed] });
    }
    
    // Auto skip ke next track jika ada
    if (player.queue.length > 0) {
        console.log(`⏭️ Auto-skipping to next track for guild ${player.guildId}`);
        setTimeout(() => player.skip(), 1000);
    }
});

kazagumo.on('playerResolveError', (player, track, message) => {
    console.error('❌ Track resolve error:', message);
    const channel = client.channels.cache.get(player.textId);
    
    if (channel) {
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setDescription(`❌ Cannot load track: **${track.title}**\n**Reason:** ${message}\n${player.queue.length > 0 ? '⏭️ Playing next track...' : ''}`)
            .setTimestamp();
        channel.send({ embeds: [embed] });
    }
    
    if (player.queue.length > 0) {
        setTimeout(() => player.skip(), 1000);
    }
});

kazagumo.on('playerException', (player, data) => {
    console.error('❌ Player exception:', data);
    const channel = client.channels.cache.get(player.textId);
    
    if (channel) {
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setDescription('❌ An error occurred while playing.\n' + (player.queue.length > 0 ? '⏭️ Skipping to next track...' : ''))
            .setTimestamp();
        channel.send({ embeds: [embed] });
    }
    
    if (player.queue.length > 0) {
        setTimeout(() => player.skip(), 1000);
    }
});

kazagumo.on('playerDestroy', (player) => {
    console.log(`🗑️ Player destroyed for guild ${player.guildId}`);
    if (disconnectTimers.has(player.guildId)) {
        clearTimeout(disconnectTimers.get(player.guildId));
        disconnectTimers.delete(player.guildId);
    }
});

// ============ BOT READY ============
client.once('ready', () => {
    console.log('═══════════════════════════════════════');
    console.log(`✅ ${client.user.tag} is online!`);
    console.log(`📊 Serving ${client.guilds.cache.size} servers`);
    console.log(`👥 ${client.users.cache.size} users`);
    console.log('═══════════════════════════════════════');
    console.log('🎵 Lavalink Nodes: ' + Nodes.length + ' configured (Top 3 Uptime)');
    
    client.user.setActivity('!help • Music Bot', { type: 2 });
});

client.on('error', (error) => console.error('Client error:', error));

// ============ MESSAGE COMMANDS ============
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // ==================== PLAY ====================
    if (command === 'play' || command === 'p') {
        if (!message.member.voice.channel) {
            return message.reply({ embeds: [errorEmbed('❌ You need to join a voice channel first!')] });
        }

        const query = args.join(' ');
        if (!query) {
            return message.reply({ embeds: [errorEmbed('❌ Please provide a song name or URL!\n**Usage:** `!play <song name/url>`')] });
        }

        // Check if any nodes are connected
        const connectedNodes = Array.from(kazagumo.shoukaku.nodes.values()).filter(n => n.state === 2);
        
        if (connectedNodes.length === 0) {
            return message.reply({ 
                embeds: [errorEmbed('❌ No Lavalink nodes available!\nPlease try again in a moment or contact bot owner.')] 
            });
        }

        const loadingMsg = await message.channel.send({ 
            embeds: [new EmbedBuilder().setColor(BOT_INFO.color).setDescription('🔍 Searching...')] 
        });

        try {
            let player = kazagumo.players.get(message.guild.id);

            if (!player) {
                player = await kazagumo.createPlayer({
                    guildId: message.guild.id,
                    textId: message.channel.id,
                    voiceId: message.member.voice.channel.id,
                    volume: 70,
                    deaf: true,
                    shardId: message.guild.shardId
                });
                console.log(`🎵 Created player for guild ${message.guild.id}`);
            }

            const result = await kazagumo.search(query, { requester: message.author });

            if (!result || !result.tracks.length) {
                await loadingMsg.edit({ embeds: [errorEmbed('❌ No results found!')] });
                return;
            }

            if (result.type === 'PLAYLIST') {
                for (const track of result.tracks) player.queue.add(track);
                await loadingMsg.edit({ 
                    embeds: [new EmbedBuilder()
                        .setColor(BOT_INFO.color)
                        .setDescription(`📃 Added **${result.tracks.length}** tracks from **${result.playlistName}**`)] 
                });
            } else {
                player.queue.add(result.tracks[0]);
                await loadingMsg.edit({ 
                    embeds: [new EmbedBuilder()
                        .setColor(BOT_INFO.color)
                        .setDescription(`✅ Added to queue: **[${result.tracks[0].title}](${result.tracks[0].uri})**`)] 
                });
            }

            if (!player.playing && !player.paused) {
                player.play();
                console.log(`▶️ Starting playback for guild ${message.guild.id}`);
            }
        } catch (error) {
            console.error('Play error:', error);
            await loadingMsg.edit({ 
                embeds: [errorEmbed(`❌ Failed to play!\n**Error:** ${error.message}\n**Connected nodes:** ${connectedNodes.length}`)] 
            });
        }
    }

    // ==================== SKIP ====================
    if (command === 'skip' || command === 's') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) return message.reply({ embeds: [errorEmbed('❌ Nothing is playing!')] });
        
        const skipped = player.queue.current;
        player.skip();
        message.channel.send({ 
            embeds: [successEmbed(`⏭️ Skipped: **${skipped?.title || 'Current track'}**`)] 
        });
    }

    // ==================== STOP ====================
    if (command === 'stop') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) return message.reply({ embeds: [errorEmbed('❌ Nothing is playing!')] });
        player.destroy();
        message.channel.send({ embeds: [successEmbed('⏹️ Stopped and left voice channel')] });
    }

    // ==================== PAUSE ====================
    if (command === 'pause') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) return message.reply({ embeds: [errorEmbed('❌ Nothing is playing!')] });
        if (player.paused) return message.reply({ embeds: [errorEmbed('❌ Already paused!')] });
        player.pause(true);
        message.channel.send({ embeds: [successEmbed('⏸️ Paused')] });
    }

    // ==================== RESUME ====================
    if (command === 'resume') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) return message.reply({ embeds: [errorEmbed('❌ Nothing is playing!')] });
        if (!player.paused) return message.reply({ embeds: [errorEmbed('❌ Not paused!')] });
        player.pause(false);
        message.channel.send({ embeds: [successEmbed('▶️ Resumed')] });
    }

    // ==================== QUEUE ====================
    if (command === 'queue' || command === 'q') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) return message.reply({ embeds: [errorEmbed('❌ Nothing is playing!')] });

        const queue = player.queue;
        const current = player.queue.current;
        if (!current) return message.reply({ embeds: [errorEmbed('❌ Queue is empty!')] });

        let description = `**Now Playing:**\n[${current.title}](${current.uri}) - \`${formatDuration(current.length)}\`\n\n`;

        if (queue.length > 0) {
            description += '**Up Next:**\n';
            queue.slice(0, 10).forEach((track, i) => {
                description += `${i + 1}. [${track.title}](${track.uri}) - \`${formatDuration(track.length)}\`\n`;
            });
            if (queue.length > 10) description += `\n*And ${queue.length - 10} more...*`;
        } else {
            description += '*No upcoming tracks*';
        }

        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.color)
            .setAuthor({ name: `Queue • ${message.guild.name}`, iconURL: message.guild.iconURL() })
            .setDescription(description)
            .setFooter({ text: `${queue.length + 1} track(s) • Volume: ${player.volume}%` });

        message.channel.send({ embeds: [embed] });
    }

    // ==================== NOW PLAYING ====================
    if (command === 'nowplaying' || command === 'np') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player?.queue.current) return message.reply({ embeds: [errorEmbed('❌ Nothing is playing!')] });

        const current = player.queue.current;
        const position = player.position;
        const duration = current.length;

        const progress = duration ? Math.round((position / duration) * 15) : 0;
        const bar = '▬'.repeat(progress) + '🔘' + '▬'.repeat(15 - progress);

        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.color)
            .setAuthor({ name: 'Now Playing', iconURL: client.user.displayAvatarURL() })
            .setTitle(current.title)
            .setURL(current.uri)
            .setThumbnail(current.thumbnail)
            .addFields(
                { name: 'Author', value: current.author || 'Unknown', inline: true },
                { name: 'Requested by', value: `${current.requester}`, inline: true },
                { name: 'Volume', value: `${player.volume}%`, inline: true }
            )
            .setDescription(`\`${formatDuration(position)}\` ${bar} \`${formatDuration(duration)}\``)
            .setFooter({ text: `Loop: ${player.loop || 'Off'}` });

        message.channel.send({ embeds: [embed] });
    }

    // ==================== LOOP ====================
    if (command === 'loop') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) return message.reply({ embeds: [errorEmbed('❌ Nothing is playing!')] });

        const mode = args[0]?.toLowerCase();
        if (!mode || !['track', 'queue', 'off'].includes(mode)) {
            return message.reply({ embeds: [errorEmbed('❌ Usage: `!loop <track/queue/off>`')] });
        }

        player.setLoop(mode === 'off' ? 'none' : mode);
        const icons = { track: '🔂', queue: '🔁', off: '➡️' };
        message.channel.send({ embeds: [successEmbed(`${icons[mode]} Loop: **${mode.charAt(0).toUpperCase() + mode.slice(1)}**`)] });
    }

    // ==================== VOLUME ====================
    if (command === 'volume' || command === 'vol') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) return message.reply({ embeds: [errorEmbed('❌ Nothing is playing!')] });

        if (!args[0]) return message.channel.send({ embeds: [successEmbed(`🔊 Current volume: **${player.volume}%**`)] });

        const volume = parseInt(args[0]);
        if (isNaN(volume) || volume < 0 || volume > 100) {
            return message.reply({ embeds: [errorEmbed('❌ Volume must be between 0-100')] });
        }

        player.setVolume(volume);
        const icon = volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊';
        message.channel.send({ embeds: [successEmbed(`${icon} Volume: **${volume}%**`)] });
    }

    // ==================== SEEK ====================
    if (command === 'seek') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player?.queue.current) return message.reply({ embeds: [errorEmbed('❌ Nothing is playing!')] });

        const time = args[0];
        if (!time) return message.reply({ embeds: [errorEmbed('❌ Usage: `!seek <1:30>` or `!seek <90>`')] });

        let ms;
        if (time.includes(':')) {
            const parts = time.split(':').map(Number);
            ms = parts.length === 2 ? (parts[0] * 60 + parts[1]) * 1000 : (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
        } else {
            ms = parseInt(time) * 1000;
        }

        if (isNaN(ms) || ms < 0 || ms > player.queue.current.length) {
            return message.reply({ embeds: [errorEmbed('❌ Invalid time!')] });
        }

        player.seek(ms);
        message.channel.send({ embeds: [successEmbed(`⏩ Seeked to **${formatDuration(ms)}**`)] });
    }

    // ==================== 8D ====================
    if (command === '8d') {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) return message.reply({ embeds: [errorEmbed('❌ Nothing is playing!')] });

        const isEnabled = player.rotation?.rotationHz;
        if (isEnabled) {
            player.setRotation({ rotationHz: 0 });
            message.channel.send({ embeds: [successEmbed('🎧 8D Audio: **Off**')] });
        } else {
            player.setRotation({ rotationHz: 0.2 });
            message.channel.send({ embeds: [successEmbed('🎧 8D Audio: **On** (Use headphones!)')] });
        }
    }

    // ==================== NODES ====================
    if (command === 'nodes') {
        const nodes = kazagumo.shoukaku.nodes;
        let description = '';
        
        for (const [name, node] of nodes) {
            const status = node.state === 2 ? '🟢 Connected' : '🔴 Disconnected';
            const stats = node.stats || {};
            description += `**${name}**\nStatus: ${status}\n`;
            if (stats.players !== undefined) description += `Players: ${stats.players}\n`;
            description += `\n`;
        }

        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.color)
            .setTitle('🌐 Lavalink Nodes')
            .setDescription(description || 'No nodes available')
            .setFooter({ text: `Total: ${nodes.size} nodes • Top 3 Uptime (97-100%)` })
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }

    // ==================== HELP ====================
    if (command === 'help') {
        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.color)
            .setAuthor({ name: BOT_INFO.name, iconURL: client.user.displayAvatarURL() })
            .setDescription(BOT_INFO.description)
            .addFields(
                { name: '🎵 Music', value: '`!play <song>` `!skip` `!stop` `!pause` `!resume`', inline: false },
                { name: '📋 Queue', value: '`!queue` `!nowplaying` `!loop <track/queue/off>`', inline: false },
                { name: '🎛️ Control', value: '`!volume <0-100>` `!seek <1:30>` `!8d`', inline: false },
                { name: 'ℹ️ Info', value: '`!info` `!nodes` `!ping`', inline: false }
            )
            .setFooter({ text: `Made by ${BOT_INFO.owner.display} • v${BOT_INFO.version}` })
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }

    // ==================== INFO ====================
    if (command === 'info') {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.color)
            .setAuthor({ name: BOT_INFO.name, iconURL: client.user.displayAvatarURL() })
            .setDescription(BOT_INFO.description)
            .addFields(
                { name: '👨‍💻 Developer', value: `<@${BOT_INFO.owner.id}>`, inline: true },
                { name: '📊 Servers', value: `${client.guilds.cache.size}`, inline: true },
                { name: '⏱️ Uptime', value: `${hours}h ${minutes}m`, inline: true },
                { name: '🏷️ Version', value: BOT_INFO.version, inline: true },
                { name: '📚 Library', value: 'Discord.js v14', inline: true },
                { name: '🎵 Audio', value: 'Lavalink v4', inline: true }
            )
            .setFooter({ text: `Requested by ${message.author.tag}` })
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }

    // ==================== PING ====================
    if (command === 'ping') {
        const latency = Date.now() - message.createdTimestamp;
        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.color)
            .setDescription(`🏓 **Pong!**\n📡 Latency: \`${latency}ms\`\n💓 API: \`${Math.round(client.ws.ping)}ms\``);

        message.channel.send({ embeds: [embed] });
    }
});

// ============ ERROR HANDLERS ============
process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

// ============ LOGIN ============
const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error('❌ DISCORD_TOKEN not found in environment variables!');
    console.error('Please set DISCORD_TOKEN in Railway Variables');
    process.exit(1);
}

console.log('🔄 Logging in to Discord...');
console.log('🎵 Configuring ' + Nodes.length + ' Lavalink nodes (Top 3 Uptime)...');

client.login(token)
    .then(() => console.log('✅ Login successful!'))
    .catch((error) => {
        console.error('❌ Login failed:', error.message);
        process.exit(1);
    });
