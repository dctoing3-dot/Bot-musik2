const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { Connectors } = require('shoukaku');
const { Kazagumo, Plugins } = require('kazagumo');
const Spotify = require('kazagumo-spotify');
const express = require('express');
require('dotenv').config();

// ============ BOT INFO ============
const BOT_INFO = {
    name: 'Melodify',
    version: '2.0.0',
    description: '🎵 High Quality Music Bot with Lavalink v4',
    owner: {
        id: '1307489983359357019',
        username: 'demisz_dc',
        display: 'Demisz'
    },
    color: '#5865F2',
    errorColor: '#ff6b6b',
    successColor: '#43b581',
    links: {
        support: 'https://discord.gg/your-server',
        invite: 'https://discord.com/oauth2/authorize?client_id=1307489983359357019&permissions=3147776&scope=bot%20applications.commands'
    }
};

// ============ EXPRESS SERVER ============
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    res.json({
        status: 'online',
        bot: BOT_INFO.name,
        version: BOT_INFO.version,
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        platform: 'Railway',
        lavalink: 'Render',
        timestamp: new Date().toISOString()
    });
});

app.get('/ping', (req, res) => res.status(200).send('OK'));
app.get('/health', (req, res) => res.status(200).json({ status: 'healthy', timestamp: Date.now() }));

app.get('/stats', (req, res) => {
    res.json({
        guilds: client.guilds?.cache?.size || 0,
        users: client.users?.cache?.size || 0,
        players: kazagumo?.players?.size || 0,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
    });
});

app.listen(PORT, () => console.log(`🌐 Express server running on port ${PORT}`));

// ============ DISCORD CLIENT ============
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    allowedMentions: { parse: ['users', 'roles'], repliedUser: true }
});

// ============ LAVALINK NODES ============
const Nodes = [
    {
        name: 'Render-Primary',
        url: process.env.LAVALINK_HOST || 'lavalink-sf9r.onrender.com:443',
        auth: process.env.LAVALINK_PASSWORD || 'your_super_strong_password_here',
        secure: true
    },
    {
        name: 'Serenetia-Backup1',
        url: 'lavalinkv4.serenetia.com:443',
        auth: 'https://dsc.gg/ajidevserver',
        secure: true
    },
    {
        name: 'Nevulink-Backup2',
        url: 'lavalink.nevuhost.com:443',
        auth: 'nevulink',
        secure: true
    }
];

// ============ KAZAGUMO MUSIC SETUP ============
const kazagumo = new Kazagumo(
    {
        defaultSearchEngine: 'youtube',
        plugins: process.env.SPOTIFY_CLIENT_ID ? [
            new Spotify({
                clientId: process.env.SPOTIFY_CLIENT_ID,
                clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
                playlistPageLimit: 1,
                albumPageLimit: 1,
                searchLimit: 10,
                searchMarket: 'US'
            })
        ] : [],
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
        reconnectTries: 10,
        reconnectInterval: 5000,
        restTimeout: 60000
    }
);

// ============ LAVALINK EVENTS ============
kazagumo.shoukaku.on('ready', (name) => {
    console.log(`✅ Lavalink [${name}] connected successfully!`);
});

kazagumo.shoukaku.on('error', (name, error) => {
    console.error(`❌ Lavalink [${name}] error:`, error.message);
});

kazagumo.shoukaku.on('close', (name, code, reason) => {
    console.warn(`⚠️ Lavalink [${name}] closed | Code: ${code} | Reason: ${reason || 'Unknown'}`);
});

kazagumo.shoukaku.on('disconnect', (name, reason) => {
    console.warn(`⚠️ Lavalink [${name}] disconnected:`, reason || 'Unknown reason');
});

kazagumo.shoukaku.on('reconnecting', (name, reconnectsLeft, reconnectInterval) => {
    console.log(`🔄 Lavalink [${name}] reconnecting... (${reconnectsLeft} attempts left)`);
});

kazagumo.shoukaku.on('debug', (name, info) => {
    if (process.env.DEBUG === 'true') {
        console.log(`🔍 Lavalink [${name}] debug:`, info);
    }
});

// ============ PLAYER EVENTS ============
kazagumo.on('playerStart', async (player, track) => {
    const channel = client.channels.cache.get(player.textId);
    if (!channel) return;

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('pause_resume')
                .setEmoji('⏯️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('skip')
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('stop')
                .setEmoji('⏹️')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('queue')
                .setEmoji('📋')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('loop')
                .setEmoji('🔁')
                .setStyle(ButtonStyle.Secondary)
        );

    const embed = new EmbedBuilder()
        .setColor(BOT_INFO.color)
        .setAuthor({ 
            name: 'Now Playing 🎵', 
            iconURL: client.user.displayAvatarURL({ dynamic: true }) 
        })
        .setTitle(track.title)
        .setURL(track.uri)
        .setThumbnail(track.thumbnail || client.user.displayAvatarURL())
        .addFields(
            { name: '👤 Artist', value: track.author || 'Unknown', inline: true },
            { name: '⏱️ Duration', value: formatDuration(track.length), inline: true },
            { name: '🎧 Requested by', value: `${track.requester}`, inline: true }
        )
        .setFooter({ 
            text: `Volume: ${player.volume}% • Queue: ${player.queue.length} tracks • ${BOT_INFO.name}`,
            iconURL: track.requester?.displayAvatarURL?.() || null
        })
        .setTimestamp();

    try {
        const msg = await channel.send({ embeds: [embed], components: [row] });
        player.nowPlayingMessage = msg;
    } catch (error) {
        console.error('Failed to send now playing message:', error);
    }
});

kazagumo.on('playerEnd', (player) => {
    if (player.nowPlayingMessage) {
        player.nowPlayingMessage.edit({ components: [] }).catch(() => {});
    }
});

kazagumo.on('playerEmpty', async (player) => {
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.errorColor)
            .setDescription('⏹️ Queue finished! Leaving voice channel...')
            .setFooter({ text: 'Use !play to add more songs' })
            .setTimestamp();
        
        await channel.send({ embeds: [embed] }).catch(() => {});
    }
    
    setTimeout(() => {
        if (player && !player.queue.current) {
            player.destroy();
        }
    }, 30000);
});

kazagumo.on('playerError', (player, error) => {
    console.error('Player error:', error);
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.errorColor)
            .setDescription('❌ An error occurred while playing. Skipping to next track...')
            .setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    }
    player.skip();
});

kazagumo.on('playerResolveError', (player, track, error) => {
    console.error('Track resolve error:', error);
    const channel = client.channels.cache.get(player.textId);
    if (channel) {
        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.errorColor)
            .setDescription(`❌ Failed to load: **${track.title}**\nSkipping...`)
            .setTimestamp();
        channel.send({ embeds: [embed] }).catch(() => {});
    }
});

kazagumo.on('playerStuck', (player, data) => {
    console.warn('Player stuck:', data);
    player.skip();
});

// ============ BOT READY ============
client.once('ready', () => {
    console.log('═'.repeat(50));
    console.log(`🤖 ${client.user.tag} is online!`);
    console.log(`📊 Serving ${client.guilds.cache.size} servers`);
    console.log(`👥 Total users: ${client.users.cache.size}`);
    console.log(`🎵 Lavalink Nodes: ${Nodes.map(n => n.name).join(', ')}`);
    console.log(`🚂 Platform: Railway`);
    console.log(`🌐 Lavalink: Render`);
    console.log('═'.repeat(50));
    
    updatePresence();
    setInterval(updatePresence, 60000);
});

function updatePresence() {
    const activities = [
        { name: `🎵 !help | ${client.guilds.cache.size} servers`, type: 2 },
        { name: `🎧 Music for everyone`, type: 2 },
        { name: `🚂 Powered by Railway`, type: 3 },
        { name: `${kazagumo.players.size} active players`, type: 3 }
    ];
    
    const activity = activities[Math.floor(Math.random() * activities.length)];
    client.user.setActivity(activity.name, { type: activity.type });
}

// ============ HELPER FUNCTIONS ============
function formatDuration(ms) {
    if (!ms || ms === 0) return '🔴 Live';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function createProgressBar(current, total, length = 15) {
    if (!total) return '▬'.repeat(length);
    const progress = Math.round((current / total) * length);
    const empty = length - progress;
    return '▓'.repeat(progress) + '░'.repeat(empty);
}

function errorEmbed(message) {
    return new EmbedBuilder()
        .setColor(BOT_INFO.errorColor)
        .setDescription(`❌ ${message}`);
}

function successEmbed(message) {
    return new EmbedBuilder()
        .setColor(BOT_INFO.successColor)
        .setDescription(`✅ ${message}`);
}

function infoEmbed(message) {
    return new EmbedBuilder()
        .setColor(BOT_INFO.color)
        .setDescription(message);
}

function truncate(str, length) {
    if (!str) return 'Unknown';
    return str.length > length ? str.substring(0, length - 3) + '...' : str;
}

// ============ BUTTON INTERACTIONS ============
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const player = kazagumo.players.get(interaction.guildId);
    
    if (!player) {
        return interaction.reply({ 
            embeds: [errorEmbed('No active player!')], 
            ephemeral: true 
        });
    }

    const memberVoice = interaction.member.voice.channel;
    const botVoice = interaction.guild.members.me.voice.channel;

    if (!memberVoice || memberVoice.id !== botVoice?.id) {
        return interaction.reply({ 
            embeds: [errorEmbed('You must be in the same voice channel!')], 
            ephemeral: true 
        });
    }

    switch (interaction.customId) {
        case 'pause_resume':
            if (player.paused) {
                player.pause(false);
                await interaction.reply({ embeds: [successEmbed('▶️ Resumed!')], ephemeral: true });
            } else {
                player.pause(true);
                await interaction.reply({ embeds: [successEmbed('⏸️ Paused!')], ephemeral: true });
            }
            break;

        case 'skip':
            if (!player.queue.current) {
                return interaction.reply({ embeds: [errorEmbed('Nothing to skip!')], ephemeral: true });
            }
            player.skip();
            await interaction.reply({ embeds: [successEmbed('⏭️ Skipped!')], ephemeral: true });
            break;

        case 'stop':
            player.queue.clear();
            player.destroy();
            await interaction.reply({ embeds: [successEmbed('⏹️ Stopped and cleared queue!')], ephemeral: true });
            break;

        case 'queue':
            const queue = player.queue;
            const current = queue.current;
            
            if (!current) {
                return interaction.reply({ embeds: [errorEmbed('Queue is empty!')], ephemeral: true });
            }

            let description = `**Now Playing:**\n[${truncate(current.title, 50)}](${current.uri})\n\n`;
            
            if (queue.length > 0) {
                description += '**Up Next:**\n';
                queue.slice(0, 5).forEach((track, i) => {
                    description += `\`${i + 1}.\` [${truncate(track.title, 40)}](${track.uri})\n`;
                });
                if (queue.length > 5) {
                    description += `\n*...and ${queue.length - 5} more*`;
                }
            }

            const queueEmbed = new EmbedBuilder()
                .setColor(BOT_INFO.color)
                .setTitle('📋 Queue')
                .setDescription(description)
                .setFooter({ text: `${queue.length + 1} total tracks` });

            await interaction.reply({ embeds: [queueEmbed], ephemeral: true });
            break;

        case 'loop':
            const modes = ['none', 'track', 'queue'];
            const currentMode = player.loop || 'none';
            const nextIndex = (modes.indexOf(currentMode) + 1) % modes.length;
            const nextMode = modes[nextIndex];
            
            player.setLoop(nextMode);
            
            const loopIcons = { none: '➡️ Off', track: '🔂 Track', queue: '🔁 Queue' };
            await interaction.reply({ 
                embeds: [successEmbed(`Loop: **${loopIcons[nextMode]}**`)], 
                ephemeral: true 
            });
            break;
    }
});

// ============ MESSAGE COMMANDS ============
const prefix = process.env.PREFIX || '!';
const cooldowns = new Map();

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;
    if (!message.guild) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Cooldown check
    const cooldownAmount = 2000;
    if (cooldowns.has(`${message.author.id}-${command}`)) {
        const expirationTime = cooldowns.get(`${message.author.id}-${command}`);
        if (Date.now() < expirationTime) {
            return message.react('⏳').catch(() => {});
        }
    }
    cooldowns.set(`${message.author.id}-${command}`, Date.now() + cooldownAmount);
    setTimeout(() => cooldowns.delete(`${message.author.id}-${command}`), cooldownAmount);

    // ==================== PLAY ====================
    if (['play', 'p', 'pl'].includes(command)) {
        if (!message.member.voice.channel) {
            return message.reply({ embeds: [errorEmbed('Join a voice channel first!')] });
        }

        const permissions = message.member.voice.channel.permissionsFor(message.guild.members.me);
        if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
            return message.reply({ embeds: [errorEmbed('I need permission to join and speak in your voice channel!')] });
        }

        const query = args.join(' ');
        if (!query) {
            return message.reply({ embeds: [errorEmbed('Please provide a song name or URL!\n\n**Usage:**\n`!play <song name>`\n`!play <YouTube URL>`\n`!play <Spotify URL>`')] });
        }

        await message.react('🔍').catch(() => {});

        try {
            let player = kazagumo.players.get(message.guild.id);

            if (!player) {
                player = await kazagumo.createPlayer({
                    guildId: message.guild.id,
                    textId: message.channel.id,
                    voiceId: message.member.voice.channel.id,
                    volume: 80,
                    deaf: true,
                    shardId: message.guild.shardId
                });
            } else if (player.voiceId !== message.member.voice.channel.id) {
                return message.reply({ embeds: [errorEmbed('You must be in the same voice channel as me!')] });
            }

            let searchEngine = 'youtube';
            if (query.includes('spotify.com')) searchEngine = 'spotify';
            else if (query.includes('soundcloud.com')) searchEngine = 'soundcloud';

            const result = await kazagumo.search(query, { 
                requester: message.author,
                engine: searchEngine
            });

            if (!result || !result.tracks || result.tracks.length === 0) {
                await message.reactions.removeAll().catch(() => {});
                return message.reply({ embeds: [errorEmbed('No results found! Try a different search term.')] });
            }

            if (result.type === 'PLAYLIST') {
                for (const track of result.tracks) {
                    player.queue.add(track);
                }
                
                const embed = new EmbedBuilder()
                    .setColor(BOT_INFO.successColor)
                    .setDescription(`📃 Added **${result.tracks.length}** tracks from playlist:\n**${result.playlistName}**`)
                    .setFooter({ text: `Requested by ${message.author.tag}` })
                    .setTimestamp();
                
                await message.reactions.removeAll().catch(() => {});
                await message.reply({ embeds: [embed] });
            } else {
                const track = result.tracks[0];
                player.queue.add(track);

                if (player.playing || player.paused) {
                    const embed = new EmbedBuilder()
                        .setColor(BOT_INFO.successColor)
                        .setDescription(`➕ Added to queue:\n**[${truncate(track.title, 60)}](${track.uri})**`)
                        .addFields(
                            { name: 'Duration', value: formatDuration(track.length), inline: true },
                            { name: 'Position', value: `#${player.queue.length}`, inline: true }
                        )
                        .setThumbnail(track.thumbnail || null)
                        .setFooter({ text: `Requested by ${message.author.tag}` })
                        .setTimestamp();
                    
                    await message.reactions.removeAll().catch(() => {});
                    await message.reply({ embeds: [embed] });
                } else {
                    await message.reactions.removeAll().catch(() => {});
                    await message.react('✅').catch(() => {});
                }
            }

            if (!player.playing && !player.paused) {
                player.play();
            }

        } catch (error) {
            console.error('Play error:', error);
            await message.reactions.removeAll().catch(() => {});
            message.reply({ embeds: [errorEmbed(`An error occurred: ${error.message || 'Unknown error'}`)] });
        }
    }

    // ==================== SKIP ====================
    if (['skip', 's', 'sk', 'next'].includes(command)) {
        const player = kazagumo.players.get(message.guild.id);
        if (!player?.queue.current) {
            return message.reply({ embeds: [errorEmbed('Nothing to skip!')] });
        }

        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceId) {
            return message.reply({ embeds: [errorEmbed('You must be in the same voice channel!')] });
        }

        const skipped = player.queue.current;
        player.skip();
        
        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.successColor)
            .setDescription(`⏭️ Skipped: **${truncate(skipped.title, 50)}**`);
        
        message.reply({ embeds: [embed] });
    }

    // ==================== STOP ====================
    if (['stop', 'leave', 'disconnect', 'dc', 'bye'].includes(command)) {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) {
            return message.reply({ embeds: [errorEmbed('Nothing is playing!')] });
        }

        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceId) {
            return message.reply({ embeds: [errorEmbed('You must be in the same voice channel!')] });
        }

        player.queue.clear();
        player.destroy();
        message.react('👋').catch(() => {});
    }

    // ==================== PAUSE ====================
    if (['pause', 'ps'].includes(command)) {
        const player = kazagumo.players.get(message.guild.id);
        if (!player?.queue.current) {
            return message.reply({ embeds: [errorEmbed('Nothing is playing!')] });
        }

        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceId) {
            return message.reply({ embeds: [errorEmbed('You must be in the same voice channel!')] });
        }

        if (player.paused) {
            return message.reply({ embeds: [infoEmbed('⏸️ Already paused! Use `!resume` to continue.')] });
        }

        player.pause(true);
        message.react('⏸️').catch(() => {});
    }

    // ==================== RESUME ====================
    if (['resume', 'rs', 'unpause', 'continue'].includes(command)) {
        const player = kazagumo.players.get(message.guild.id);
        if (!player?.queue.current) {
            return message.reply({ embeds: [errorEmbed('Nothing is playing!')] });
        }

        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceId) {
            return message.reply({ embeds: [errorEmbed('You must be in the same voice channel!')] });
        }

        if (!player.paused) {
            return message.reply({ embeds: [infoEmbed('▶️ Already playing!')] });
        }

        player.pause(false);
        message.react('▶️').catch(() => {});
    }

    // ==================== QUEUE ====================
    if (['queue', 'q', 'list'].includes(command)) {
        const player = kazagumo.players.get(message.guild.id);
        if (!player?.queue.current) {
            return message.reply({ embeds: [errorEmbed('Queue is empty! Use `!play` to add songs.')] });
        }

        const current = player.queue.current;
        const queue = player.queue;
        const page = parseInt(args[0]) || 1;
        const itemsPerPage = 10;
        const totalPages = Math.ceil(queue.length / itemsPerPage) || 1;
        const validPage = Math.min(Math.max(page, 1), totalPages);
        const startIndex = (validPage - 1) * itemsPerPage;

        let description = `**🎵 Now Playing:**\n[${truncate(current.title, 55)}](${current.uri})\n`;
        description += `\`${formatDuration(player.position)}\` ${createProgressBar(player.position, current.length, 12)} \`${formatDuration(current.length)}\`\n\n`;

        if (queue.length > 0) {
            description += '**📋 Up Next:**\n';
            const pageItems = queue.slice(startIndex, startIndex + itemsPerPage);
            pageItems.forEach((track, i) => {
                const index = startIndex + i + 1;
                description += `\`${index}.\` [${truncate(track.title, 45)}](${track.uri}) • \`${formatDuration(track.length)}\`\n`;
            });
        } else {
            description += '*No more songs in queue*';
        }

        const totalDuration = queue.reduce((acc, track) => acc + (track.length || 0), current.length || 0);

        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.color)
            .setAuthor({ 
                name: `Queue for ${message.guild.name}`, 
                iconURL: message.guild.iconURL({ dynamic: true }) 
            })
            .setDescription(description)
            .setFooter({ 
                text: `Page ${validPage}/${totalPages} • ${queue.length + 1} tracks • Total: ${formatDuration(totalDuration)} • Loop: ${player.loop || 'Off'}` 
            })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }

    // ==================== NOW PLAYING ====================
    if (['nowplaying', 'np', 'now', 'current', 'playing'].includes(command)) {
        const player = kazagumo.players.get(message.guild.id);
        if (!player?.queue.current) {
            return message.reply({ embeds: [errorEmbed('Nothing is playing!')] });
        }

        const current = player.queue.current;
        const position = player.position;
        const duration = current.length;
        const progress = createProgressBar(position, duration, 20);

        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.color)
            .setAuthor({ 
                name: player.paused ? '⏸️ Paused' : '🎵 Now Playing', 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTitle(current.title)
            .setURL(current.uri)
            .setThumbnail(current.thumbnail || null)
            .setDescription(`\`${formatDuration(position)}\` ${progress} \`${formatDuration(duration)}\``)
            .addFields(
                { name: '👤 Artist', value: current.author || 'Unknown', inline: true },
                { name: '🎧 Requested by', value: `${current.requester}`, inline: true },
                { name: '🔊 Volume', value: `${player.volume}%`, inline: true },
                { name: '🔁 Loop', value: player.loop || 'Off', inline: true },
                { name: '📋 Queue', value: `${player.queue.length} tracks`, inline: true },
                { name: '🎵 Source', value: getSourceEmoji(current.uri), inline: true }
            )
            .setFooter({ text: BOT_INFO.name })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }

    // ==================== LOOP ====================
    if (['loop', 'lp', 'repeat'].includes(command)) {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) {
            return message.reply({ embeds: [errorEmbed('Nothing is playing!')] });
        }

        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceId) {
            return message.reply({ embeds: [errorEmbed('You must be in the same voice channel!')] });
        }

        const mode = args[0]?.toLowerCase();
        const validModes = ['track', 'queue', 'off', 'song', 'all', 'none', 'disable'];
        
        if (!mode) {
            const currentLoop = player.loop || 'none';
            return message.reply({ 
                embeds: [infoEmbed(`🔁 Current loop mode: **${currentLoop}**\n\n**Usage:**\n\`!loop track\` - Loop current song\n\`!loop queue\` - Loop entire queue\n\`!loop off\` - Disable loop`)] 
            });
        }

        if (!validModes.includes(mode)) {
            return message.reply({ embeds: [errorEmbed('Invalid mode! Use: `track`, `queue`, or `off`')] });
        }

        let setMode;
        if (['track', 'song'].includes(mode)) setMode = 'track';
        else if (['queue', 'all'].includes(mode)) setMode = 'queue';
        else setMode = 'none';

        player.setLoop(setMode);
        
        const icons = { track: '🔂 Track', queue: '🔁 Queue', none: '➡️ Off' };
        message.reply({ embeds: [successEmbed(`Loop mode: **${icons[setMode]}**`)] });
    }

    // ==================== VOLUME ====================
    if (['volume', 'vol', 'v'].includes(command)) {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) {
            return message.reply({ embeds: [errorEmbed('Nothing is playing!')] });
        }

        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceId) {
            return message.reply({ embeds: [errorEmbed('You must be in the same voice channel!')] });
        }

        if (!args[0]) {
            const volumeBar = createProgressBar(player.volume, 100, 10);
            return message.reply({ embeds: [infoEmbed(`🔊 Current volume: **${player.volume}%**\n${volumeBar}`)] });
        }

        const volume = parseInt(args[0]);
        if (isNaN(volume) || volume < 0 || volume > 150) {
            return message.reply({ embeds: [errorEmbed('Volume must be between 0 and 150!')] });
        }

        player.setVolume(volume);
        
        let icon;
        if (volume === 0) icon = '🔇';
        else if (volume < 30) icon = '🔈';
        else if (volume < 70) icon = '🔉';
        else icon = '🔊';

        message.reply({ embeds: [successEmbed(`${icon} Volume set to: **${volume}%**`)] });
    }

    // ==================== SEEK ====================
    if (['seek', 'goto', 'jump'].includes(command)) {
        const player = kazagumo.players.get(message.guild.id);
        if (!player?.queue.current) {
            return message.reply({ embeds: [errorEmbed('Nothing is playing!')] });
        }

        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceId) {
            return message.reply({ embeds: [errorEmbed('You must be in the same voice channel!')] });
        }

        const time = args[0];
        if (!time) {
            return message.reply({ embeds: [errorEmbed('Please provide a time!\n\n**Examples:**\n`!seek 1:30` - Seek to 1 minute 30 seconds\n`!seek 90` - Seek to 90 seconds')] });
        }

        let ms;
        if (time.includes(':')) {
            const parts = time.split(':').map(Number);
            if (parts.some(isNaN)) {
                return message.reply({ embeds: [errorEmbed('Invalid time format!')] });
            }
            if (parts.length === 2) {
                ms = (parts[0] * 60 + parts[1]) * 1000;
            } else if (parts.length === 3) {
                ms = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
            }
        } else {
            ms = parseInt(time) * 1000;
        }

        if (isNaN(ms) || ms < 0) {
            return message.reply({ embeds: [errorEmbed('Invalid time!')] });
        }

        if (ms > player.queue.current.length) {
            return message.reply({ embeds: [errorEmbed(`Cannot seek beyond track duration! (${formatDuration(player.queue.current.length)})`)] });
        }

        player.seek(ms);
        message.reply({ embeds: [successEmbed(`⏩ Seeked to **${formatDuration(ms)}**`)] });
    }

    // ==================== SHUFFLE ====================
    if (['shuffle', 'sh', 'mix', 'random'].includes(command)) {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) {
            return message.reply({ embeds: [errorEmbed('Nothing is playing!')] });
        }

        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceId) {
            return message.reply({ embeds: [errorEmbed('You must be in the same voice channel!')] });
        }

        if (player.queue.length < 2) {
            return message.reply({ embeds: [errorEmbed('Need at least 2 songs in queue to shuffle!')] });
        }

        player.queue.shuffle();
        message.reply({ embeds: [successEmbed(`🔀 Shuffled **${player.queue.length}** tracks!`)] });
    }

    // ==================== CLEAR ====================
    if (['clear', 'cl', 'empty'].includes(command)) {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) {
            return message.reply({ embeds: [errorEmbed('Nothing is playing!')] });
        }

        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceId) {
            return message.reply({ embeds: [errorEmbed('You must be in the same voice channel!')] });
        }

        if (player.queue.length === 0) {
            return message.reply({ embeds: [errorEmbed('Queue is already empty!')] });
        }

        const count = player.queue.length;
        player.queue.clear();
        message.reply({ embeds: [successEmbed(`🗑️ Cleared **${count}** tracks from the queue!`)] });
    }

    // ==================== REMOVE ====================
    if (['remove', 'rm', 'delete'].includes(command)) {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) {
            return message.reply({ embeds: [errorEmbed('Nothing is playing!')] });
        }

        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceId) {
            return message.reply({ embeds: [errorEmbed('You must be in the same voice channel!')] });
        }

        const position = parseInt(args[0]);
        if (!position || isNaN(position) || position < 1 || position > player.queue.length) {
            return message.reply({ embeds: [errorEmbed(`Please provide a valid position! (1-${player.queue.length})`)] });
        }

        const removed = player.queue.splice(position - 1, 1)[0];
        message.reply({ embeds: [successEmbed(`🗑️ Removed: **${truncate(removed.title, 50)}**`)] });
    }

    // ==================== SKIPTO ====================
    if (['skipto', 'st', 'jumpto', 'playat'].includes(command)) {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) {
            return message.reply({ embeds: [errorEmbed('Nothing is playing!')] });
        }

        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceId) {
            return message.reply({ embeds: [errorEmbed('You must be in the same voice channel!')] });
        }

        const position = parseInt(args[0]);
        if (!position || isNaN(position) || position < 1 || position > player.queue.length) {
            return message.reply({ embeds: [errorEmbed(`Please provide a valid position! (1-${player.queue.length})`)] });
        }

        player.queue.splice(0, position - 1);
        player.skip();
        
        message.reply({ embeds: [successEmbed(`⏭️ Skipped to track #${position}`)] });
    }

    // ==================== 8D AUDIO ====================
    if (['8d', 'rotate', 'rotation'].includes(command)) {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) {
            return message.reply({ embeds: [errorEmbed('Nothing is playing!')] });
        }

        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceId) {
            return message.reply({ embeds: [errorEmbed('You must be in the same voice channel!')] });
        }

        const isEnabled = player.filters?.rotation?.rotationHz;
        
        if (isEnabled) {
            player.setRotation();
            message.reply({ embeds: [successEmbed('🎧 8D Audio: **Disabled**')] });
        } else {
            player.setRotation({ rotationHz: 0.2 });
            message.reply({ embeds: [successEmbed('🎧 8D Audio: **Enabled**\n*Use headphones for best experience!*')] });
        }
    }

    // ==================== BASSBOOST ====================
    if (['bassboost', 'bass', 'bb'].includes(command)) {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) {
            return message.reply({ embeds: [errorEmbed('Nothing is playing!')] });
        }

        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceId) {
            return message.reply({ embeds: [errorEmbed('You must be in the same voice channel!')] });
        }

        const level = args[0]?.toLowerCase();
        
        const bassLevels = {
            off: null,
            low: [0.1, 0.1, 0.05, 0.05, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            medium: [0.2, 0.2, 0.15, 0.1, 0.05, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            high: [0.3, 0.3, 0.25, 0.2, 0.1, 0.05, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            extreme: [0.5, 0.5, 0.4, 0.3, 0.2, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        };

        if (!level || !bassLevels.hasOwnProperty(level)) {
            return message.reply({ 
                embeds: [infoEmbed('🔊 **Bass Boost Levels:**\n`!bass off` - Disable\n`!bass low` - Light boost\n`!bass medium` - Medium boost\n`!bass high` - Heavy boost\n`!bass extreme` - Maximum boost')] 
            });
        }

        if (level === 'off') {
            player.setEqualizer([]);
            message.reply({ embeds: [successEmbed('🔊 Bass Boost: **Disabled**')] });
        } else {
            const bands = bassLevels[level].map((gain, band) => ({ band, gain }));
            player.setEqualizer(bands);
            message.reply({ embeds: [successEmbed(`🔊 Bass Boost: **${level.charAt(0).toUpperCase() + level.slice(1)}**`)] });
        }
    }

    // ==================== NIGHTCORE ====================
    if (['nightcore', 'nc'].includes(command)) {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) {
            return message.reply({ embeds: [errorEmbed('Nothing is playing!')] });
        }

        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceId) {
            return message.reply({ embeds: [errorEmbed('You must be in the same voice channel!')] });
        }

        const isEnabled = player.filters?.timescale?.rate === 1.2;
        
        if (isEnabled) {
            player.setTimescale();
            message.reply({ embeds: [successEmbed('🌙 Nightcore: **Disabled**')] });
        } else {
            player.setTimescale({ speed: 1.2, pitch: 1.2, rate: 1.2 });
            message.reply({ embeds: [successEmbed('🌙 Nightcore: **Enabled**')] });
        }
    }

    // ==================== VAPORWAVE ====================
    if (['vaporwave', 'vw', 'slowed'].includes(command)) {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) {
            return message.reply({ embeds: [errorEmbed('Nothing is playing!')] });
        }

        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceId) {
            return message.reply({ embeds: [errorEmbed('You must be in the same voice channel!')] });
        }

        const isEnabled = player.filters?.timescale?.rate === 0.8;
        
        if (isEnabled) {
            player.setTimescale();
            message.reply({ embeds: [successEmbed('🌊 Vaporwave: **Disabled**')] });
        } else {
            player.setTimescale({ speed: 0.8, pitch: 0.8, rate: 0.8 });
            message.reply({ embeds: [successEmbed('🌊 Vaporwave: **Enabled**')] });
        }
    }

    // ==================== FILTERS RESET ====================
    if (['reset', 'resetfilters', 'clearfilters', 'cf'].includes(command)) {
        const player = kazagumo.players.get(message.guild.id);
        if (!player) {
            return message.reply({ embeds: [errorEmbed('Nothing is playing!')] });
        }

        if (!message.member.voice.channel || message.member.voice.channel.id !== player.voiceId) {
            return message.reply({ embeds: [errorEmbed('You must be in the same voice channel!')] });
        }

        player.setEqualizer([]);
        player.setTimescale();
        player.setRotation();
        player.setDistortion();
        player.setKaraoke();
        player.setVibrato();
        player.setTremolo();

        message.reply({ embeds: [successEmbed('🔄 All filters have been reset!')] });
    }

    // ==================== NODES ====================
    if (['nodes', 'node', 'lavalink', 'll'].includes(command)) {
        const nodesInfo = kazagumo.shoukaku.nodes;
        let description = '';

        const stateEmojis = {
            0: '🟡 CONNECTING',
            1: '🟡 NEARLY',
            2: '🟢 CONNECTED',
            3: '🟡 RECONNECTING',
            4: '🔴 DISCONNECTING',
            5: '🔴 DISCONNECTED'
        };

        nodesInfo.forEach((node, name) => {
            const status = stateEmojis[node.state] || '❓ UNKNOWN';
            const stats = node.stats;
            
            description += `**${name}**\n`;
            description += `├ Status: ${status}\n`;
            
            if (stats) {
                const memUsed = Math.round(stats.memory.used / 1024 / 1024);
                const memTotal = Math.round(stats.memory.reservable / 1024 / 1024);
                const cpuLoad = (stats.cpu.lavalinkLoad * 100).toFixed(1);
                
                description += `├ Players: ${stats.players} (${stats.playingPlayers} playing)\n`;
                description += `├ Memory: ${memUsed}MB / ${memTotal}MB\n`;
                description += `├ CPU: ${cpuLoad}%\n`;
                description += `└ Uptime: ${formatDuration(stats.uptime)}\n`;
            } else {
                description += `└ No stats available\n`;
            }
            description += `\n`;
        });

        const connectedNodes = Array.from(nodesInfo.values()).filter(n => n.state === 2).length;

        const embed = new EmbedBuilder()
            .setColor(connectedNodes > 0 ? BOT_INFO.successColor : BOT_INFO.errorColor)
            .setAuthor({ 
                name: '🎵 Lavalink Nodes Status', 
                iconURL: client.user.displayAvatarURL() 
            })
            .setDescription(description || 'No nodes configured')
            .setFooter({ 
                text: `${connectedNodes}/${nodesInfo.size} nodes connected • Lavalink: Render • Bot: Railway` 
            })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }

    // ==================== HELP ====================
    if (['help', 'h', 'commands', 'cmd'].includes(command)) {
        const category = args[0]?.toLowerCase();

        if (category === 'music' || category === 'm') {
            const embed = new EmbedBuilder()
                .setColor(BOT_INFO.color)
                .setTitle('🎵 Music Commands')
                .setDescription(
                    '```\n' +
                    '!play <song>     - Play a song/playlist\n' +
                    '!skip            - Skip current song\n' +
                    '!stop            - Stop and leave\n' +
                    '!pause           - Pause playback\n' +
                    '!resume          - Resume playback\n' +
                    '!seek <time>     - Seek to position\n' +
                    '!volume <0-150>  - Set volume\n' +
                    '!loop <mode>     - Set loop mode\n' +
                    '```'
                )
                .setFooter({ text: `${prefix}help queue | ${prefix}help filters | ${prefix}help info` });
            return message.reply({ embeds: [embed] });
        }

        if (category === 'queue' || category === 'q') {
            const embed = new EmbedBuilder()
                .setColor(BOT_INFO.color)
                .setTitle('📋 Queue Commands')
                .setDescription(
                    '```\n' +
                    '!queue [page]    - View queue\n' +
                    '!nowplaying      - Current song info\n' +
                    '!shuffle         - Shuffle queue\n' +
                    '!clear           - Clear queue\n' +
                    '!remove <pos>    - Remove track\n' +
                    '!skipto <pos>    - Skip to position\n' +
                    '```'
                )
                .setFooter({ text: `${prefix}help music | ${prefix}help filters | ${prefix}help info` });
            return message.reply({ embeds: [embed] });
        }

        if (category === 'filters' || category === 'f') {
            const embed = new EmbedBuilder()
                .setColor(BOT_INFO.color)
                .setTitle('🎛️ Filter Commands')
                .setDescription(
                    '```\n' +
                    '!8d              - Toggle 8D audio\n' +
                    '!bassboost <lvl> - Bass boost\n' +
                    '!nightcore       - Toggle nightcore\n' +
                    '!vaporwave       - Toggle vaporwave\n' +
                    '!reset           - Reset all filters\n' +
                    '```\n' +
                    '**Bass levels:** off, low, medium, high, extreme'
                )
                .setFooter({ text: `${prefix}help music | ${prefix}help queue | ${prefix}help info` });
            return message.reply({ embeds: [embed] });
        }

        if (category === 'info' || category === 'i') {
            const embed = new EmbedBuilder()
                .setColor(BOT_INFO.color)
                .setTitle('ℹ️ Info Commands')
                .setDescription(
                    '```\n' +
                    '!info            - Bot information\n' +
                    '!ping            - Check latency\n' +
                    '!nodes           - Lavalink status\n' +
                    '!invite          - Invite bot\n' +
                    '!support         - Support server\n' +
                    '```'
                )
                .setFooter({ text: `${prefix}help music | ${prefix}help queue | ${prefix}help filters` });
            return message.reply({ embeds: [embed] });
        }

        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.color)
            .setAuthor({ 
                name: BOT_INFO.name, 
                iconURL: client.user.displayAvatarURL({ dynamic: true }) 
            })
            .setDescription(BOT_INFO.description)
            .addFields(
                {
                    name: '🎵 Music',
                    value: '`play` `skip` `stop` `pause` `resume` `seek` `volume` `loop`',
                    inline: false
                },
                {
                    name: '📋 Queue',
                    value: '`queue` `nowplaying` `shuffle` `clear` `remove` `skipto`',
                    inline: false
                },
                {
                    name: '🎛️ Filters',
                    value: '`8d` `bassboost` `nightcore` `vaporwave` `reset`',
                    inline: false
                },
                {
                    name: 'ℹ️ Info',
                    value: '`info` `ping` `nodes` `invite` `support`',
                    inline: false
                },
                {
                    name: '📖 Detailed Help',
                    value: `\`${prefix}help music\` \`${prefix}help queue\` \`${prefix}help filters\` \`${prefix}help info\``,
                    inline: false
                }
            )
            .setFooter({ text: `Prefix: ${prefix} • Made by ${BOT_INFO.owner.display}` })
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }

    // ==================== INFO ====================
    if (['info', 'about', 'botinfo', 'stats'].includes(command)) {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        const memUsage = process.memoryUsage();
        const memUsed = Math.round(memUsage.heapUsed / 1024 / 1024);
        const memTotal = Math.round(memUsage.heapTotal / 1024 / 1024);

        const activeNodes = Array.from(kazagumo.shoukaku.nodes.values()).filter(n => n.state === 2);
        const totalPlayers = kazagumo.players.size;
        const playingPlayers = Array.from(kazagumo.players.values()).filter(p => p.playing).length;

        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.color)
            .setAuthor({ 
                name: BOT_INFO.name, 
                iconURL: client.user.displayAvatarURL({ dynamic: true }) 
            })
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setDescription(BOT_INFO.description)
            .addFields(
                { name: '👨‍💻 Developer', value: `<@${BOT_INFO.owner.id}>`, inline: true },
                { name: '📊 Servers', value: `${client.guilds.cache.size}`, inline: true },
                { name: '👥 Users', value: `${client.users.cache.size}`, inline: true },
                { name: '⏱️ Uptime', value: `${days}d ${hours}h ${minutes}m`, inline: true },
                { name: '🎵 Players', value: `${playingPlayers}/${totalPlayers}`, inline: true },
                { name: '📡 Nodes', value: `${activeNodes.length}/${Nodes.length}`, inline: true },
                { name: '💾 Memory', value: `${memUsed}MB / ${memTotal}MB`, inline: true },
                { name: '🏷️ Version', value: BOT_INFO.version, inline: true },
                { name: '📚 Library', value: 'Discord.js v14', inline: true },
                { name: '🚂 Bot Host', value: 'Railway', inline: true },
                { name: '🌐 Lavalink', value: 'Render', inline: true },
                { name: '⚡ Node.js', value: process.version, inline: true }
            )
            .setFooter({ text: `Requested by ${message.author.tag}` })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Invite Bot')
                    .setStyle(ButtonStyle.Link)
                    .setURL(BOT_INFO.links.invite)
                    .setEmoji('➕'),
                new ButtonBuilder()
                    .setLabel('Support Server')
                    .setStyle(ButtonStyle.Link)
                    .setURL(BOT_INFO.links.support)
                    .setEmoji('💬')
            );

        message.reply({ embeds: [embed], components: [row] });
    }

    // ==================== PING ====================
    if (['ping', 'latency', 'ms'].includes(command)) {
        const start = Date.now();
        const msg = await message.reply({ embeds: [infoEmbed('🏓 Pinging...')] });
        const latency = Date.now() - start;
        const apiLatency = Math.round(client.ws.ping);

        const nodes = kazagumo.shoukaku.nodes;
        let nodeStatus = '';
        nodes.forEach((node, name) => {
            const emoji = node.state === 2 ? '🟢' : node.state === 0 ? '🟡' : '🔴';
            nodeStatus += `${emoji} ${name}\n`;
        });

        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.color)
            .setTitle('🏓 Pong!')
            .addFields(
                { name: '📡 Bot Latency', value: `\`${latency}ms\``, inline: true },
                { name: '💓 API Latency', value: `\`${apiLatency}ms\``, inline: true },
                { name: '🎵 Lavalink Nodes', value: nodeStatus || 'No nodes', inline: false }
            )
            .setFooter({ text: '🚂 Railway • 🌐 Render Lavalink' })
            .setTimestamp();

        msg.edit({ embeds: [embed] });
    }

    // ==================== INVITE ====================
    if (['invite', 'inv', 'add'].includes(command)) {
        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.color)
            .setTitle('➕ Invite Melodify')
            .setDescription(`Click the button below to add ${BOT_INFO.name} to your server!`)
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true }));

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Invite Bot')
                    .setStyle(ButtonStyle.Link)
                    .setURL(BOT_INFO.links.invite)
                    .setEmoji('🎵')
            );

        message.reply({ embeds: [embed], components: [row] });
    }

    // ==================== SUPPORT ====================
    if (['support', 'server', 'discord'].includes(command)) {
        const embed = new EmbedBuilder()
            .setColor(BOT_INFO.color)
            .setTitle('💬 Support Server')
            .setDescription('Need help? Join our support server!')
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true }));

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Join Support Server')
                    .setStyle(ButtonStyle.Link)
                    .setURL(BOT_INFO.links.support)
                    .setEmoji('💬')
            );

        message.reply({ embeds: [embed], components: [row] });
    }
});

// ============ HELPER: GET SOURCE EMOJI ============
function getSourceEmoji(uri) {
    if (!uri) return '🎵 Unknown';
    if (uri.includes('youtube.com') || uri.includes('youtu.be')) return '▶️ YouTube';
    if (uri.includes('spotify.com')) return '💚 Spotify';
    if (uri.includes('soundcloud.com')) return '🟠 SoundCloud';
    if (uri.includes('twitch.tv')) return '💜 Twitch';
    if (uri.includes('bandcamp.com')) return '🎵 Bandcamp';
    if (uri.includes('vimeo.com')) return '🔵 Vimeo';
    return '🎵 Direct';
}

// ============ RAW EVENT FOR VOICE ============
client.on('raw', (d) => kazagumo.shoukaku.send(d));

// ============ ERROR HANDLING ============
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

// ============ GRACEFUL SHUTDOWN ============
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    kazagumo.players.forEach(player => player.destroy());
    client.destroy();
    process.exit(0);
});

// ============ LOGIN ============
client.login(process.env.DISCORD_TOKEN);
