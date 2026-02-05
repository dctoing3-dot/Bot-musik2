const { Client, GatewayIntentBits } = require('discord.js');
const { Connectors } = require('shoukaku');
const { Kazagumo } = require('kazagumo');
const express = require('express');
require('dotenv').config();

// ============ EXPRESS ============
const app = express();
app.get('/', (req, res) => res.json({ status: 'online', bot: 'Melodify', uptime: process.uptime() }));
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

// ============ MULTIPLE LAVALINK NODES ============
const Nodes = [
    {
        name: 'Serenetia',
        url: 'lavalinkv4.serenetia.com:443',
        auth: 'https://dsc.gg/ajidevserver',
        secure: true
    },
    {
        name: 'MyRender',
        url: process.env.LAVALINK_HOST || 'lavalink-sf9r.onrender.com:443',
        auth: process.env.LAVALINK_PASSWORD || 'your_super_strong_password_here',
        secure: true
    },
    {
        name: 'Nevulink',
        url: 'lavalink.nevuhost.com:443',
        auth: 'nevulink',
        secure: true
    }
];

// ============ KAZAGUMO ============
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
        reconnectTries: 2,
        reconnectInterval: 10000,
        restTimeout: 60000
    }
);

// ============ PREFERRED NODE ============
let preferredNode = 'auto';

// ============ LAVALINK EVENTS ============
kazagumo.shoukaku.on('ready', (name) => console.log(`✅ [${name}] Connected!`));
kazagumo.shoukaku.on('error', (name, err) => console.log(`❌ [${name}] Error: ${err.message}`));
kazagumo.shoukaku.on('disconnect', (name) => console.log(`⚠️ [${name}] Disconnected`));

// ============ PLAYER EVENTS ============
kazagumo.on('playerStart', (player, track) => {
    const ch = client.channels.cache.get(player.textId);
    if (ch) {
        ch.send(`🎵 **Now Playing:** ${track.title}\n👤 Artist: ${track.author || 'Unknown'}\n🔗 <${track.uri}>`);
    }
});

kazagumo.on('playerEmpty', (player) => {
    const ch = client.channels.cache.get(player.textId);
    if (ch) ch.send('⏹️ Queue selesai! Leaving...');
    player.destroy();
});

kazagumo.on('playerError', (player, err) => {
    console.log('Player error:', err);
    const ch = client.channels.cache.get(player.textId);
    if (ch) ch.send('❌ Error playing, skipping...');
});

// ============ BOT READY ============
client.on('ready', () => {
    console.log('═'.repeat(40));
    console.log(`🤖 ${client.user.tag} online!`);
    console.log(`📊 ${client.guilds.cache.size} servers`);
    console.log(`🎵 Nodes: ${Nodes.map(n => n.name).join(', ')}`);
    console.log('═'.repeat(40));
    client.user.setActivity('!help | Music Bot', { type: 2 });
});

// ============ HELPERS ============
function getOnlineNodes() {
    const online = [];
    kazagumo.shoukaku.nodes.forEach((node, name) => {
        if (node.state === 2) online.push({ name, node });
    });
    return online;
}

function getBestNode() {
    const online = getOnlineNodes();
    if (online.length === 0) return null;
    
    if (preferredNode !== 'auto') {
        const preferred = online.find(n => n.name.toLowerCase() === preferredNode.toLowerCase());
        if (preferred) return preferred.name;
    }
    
    return online[0].name;
}

// ============ COMMANDS ============
client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.content.startsWith('!')) return;
    
    const args = msg.content.slice(1).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    // ==================== PING ====================
    if (cmd === 'ping') {
        return msg.reply(`🏓 Pong! \`${Date.now() - msg.createdTimestamp}ms\` | API: \`${client.ws.ping}ms\``);
    }

    // ==================== NODES ====================
    if (cmd === 'nodes') {
        let text = '**🎵 Lavalink Nodes:**\n\n';
        
        kazagumo.shoukaku.nodes.forEach((node, name) => {
            const states = ['🟡 Connecting', '🟡 Nearly', '🟢 Online', '🟡 Reconnecting', '🔴 Disconnecting', '🔴 Offline'];
            const status = states[node.state] || '❓ Unknown';
            const isPreferred = preferredNode === name.toLowerCase() ? ' ⭐' : '';
            
            text += `**${name}${isPreferred}:** ${status}\n`;
            
            if (node.stats) {
                text += `└ Players: ${node.stats.players} | Mem: ${Math.round(node.stats.memory.used/1024/1024)}MB\n`;
            }
            text += '\n';
        });
        
        text += `**Current Mode:** \`${preferredNode}\`\n`;
        text += `\n💡 Use \`!setnode <name/auto>\` to switch`;
        
        return msg.reply(text);
    }

    // ==================== SETNODE ====================
    if (cmd === 'setnode' || cmd === 'node') {
        const nodeName = args[0]?.toLowerCase();
        
        if (!nodeName) {
            return msg.reply(`
**📡 Available Nodes:**
• \`serenetia\` - Public (Stable)
• \`myrender\` - Your Render server
• \`nevulink\` - Public backup
• \`auto\` - Auto select best

**Current:** \`${preferredNode}\`
**Usage:** \`!setnode serenetia\`
            `);
        }
        
        const validNodes = ['serenetia', 'myrender', 'nevulink', 'auto'];
        
        if (!validNodes.includes(nodeName)) {
            return msg.reply(`❌ Node tidak valid!\n\nPilihan: ${validNodes.join(', ')}`);
        }
        
        preferredNode = nodeName;
        
        const onlineNodes = getOnlineNodes();
        const targetOnline = nodeName === 'auto' 
            ? onlineNodes.length > 0 
            : onlineNodes.some(n => n.name.toLowerCase() === nodeName);
        
        const statusIcon = targetOnline ? '🟢' : '🔴';
        
        return msg.reply(`✅ Node diubah ke: **${nodeName}** ${statusIcon}\n\n${targetOnline ? 'Siap digunakan!' : '⚠️ Node ini sedang offline, akan auto-fallback ke node lain.'}`);
    }

    // ==================== PLAY ====================
    if (cmd === 'play' || cmd === 'p') {
        if (!msg.member.voice.channel) {
            return msg.reply('❌ Masuk voice channel dulu!');
        }

        const query = args.join(' ');
        if (!query) {
            return msg.reply('❌ Contoh: `!play never gonna give you up`');
        }

        const bestNode = getBestNode();
        if (!bestNode) {
            return msg.reply('❌ Semua Lavalink offline! Coba lagi nanti.\n\nCek status: `!nodes`');
        }

        try {
            let player = kazagumo.players.get(msg.guild.id);
            
            if (!player) {
                player = await kazagumo.createPlayer({
                    guildId: msg.guild.id,
                    textId: msg.channel.id,
                    voiceId: msg.member.voice.channel.id,
                    volume: 80,
                    deaf: true
                });
            }

            const searchMsg = await msg.reply(`🔍 Mencari: **${query}**...\n📡 Node: ${bestNode}`);
            
            const result = await kazagumo.search(query, { requester: msg.author });
            
            if (!result?.tracks?.length) {
                return searchMsg.edit('❌ Tidak ditemukan!');
            }

            if (result.type === 'PLAYLIST') {
                for (const track of result.tracks) player.queue.add(track);
                searchMsg.edit(`📃 Added **${result.tracks.length}** tracks dari **${result.playlistName}**`);
            } else {
                const track = result.tracks[0];
                player.queue.add(track);
                
                if (!player.playing && !player.paused) {
                    player.play();
                    searchMsg.edit(`✅ Playing: **${track.title}**`);
                } else {
                    searchMsg.edit(`➕ Added: **${track.title}** (Queue: #${player.queue.length})`);
                }
            }

            if (!player.playing && !player.paused) player.play();

        } catch (error) {
            console.error('Play error:', error);
            msg.reply(`❌ Error: ${error.message}\n\n💡 Coba \`!setnode serenetia\` lalu coba lagi.`);
        }
    }

    // ==================== STOP ====================
    if (cmd === 'stop' || cmd === 'dc' || cmd === 'leave') {
        const player = kazagumo.players.get(msg.guild.id);
        if (player) { player.destroy(); msg.react('👋'); }
        else msg.reply('❌ Nothing playing!');
    }

    // ==================== SKIP ====================
    if (cmd === 'skip' || cmd === 's') {
        const player = kazagumo.players.get(msg.guild.id);
        if (player?.queue.current) { player.skip(); msg.react('⏭️'); }
        else msg.reply('❌ Nothing to skip!');
    }

    // ==================== PAUSE ====================
    if (cmd === 'pause') {
        const player = kazagumo.players.get(msg.guild.id);
        if (player) { player.pause(true); msg.react('⏸️'); }
    }

    // ==================== RESUME ====================
    if (cmd === 'resume') {
        const player = kazagumo.players.get(msg.guild.id);
        if (player) { player.pause(false); msg.react('▶️'); }
    }

    // ==================== QUEUE ====================
    if (cmd === 'queue' || cmd === 'q') {
        const player = kazagumo.players.get(msg.guild.id);
        if (!player?.queue.current) return msg.reply('❌ Queue kosong!');

        let text = `🎵 **Now:** ${player.queue.current.title}\n`;
        if (player.queue.length > 0) {
            text += `\n📋 **Up Next (${player.queue.length}):**\n`;
            player.queue.slice(0, 5).forEach((t, i) => text += `${i+1}. ${t.title}\n`);
            if (player.queue.length > 5) text += `...dan ${player.queue.length - 5} lagi`;
        }
        msg.reply(text);
    }

    // ==================== NOW PLAYING ====================
    if (cmd === 'np' || cmd === 'nowplaying') {
        const player = kazagumo.players.get(msg.guild.id);
        if (!player?.queue.current) return msg.reply('❌ Nothing playing!');
        
        const t = player.queue.current;
        msg.reply(`🎵 **${t.title}**\n👤 ${t.author}\n🔗 ${t.uri}`);
    }

    // ==================== VOLUME ====================
    if (cmd === 'vol' || cmd === 'volume') {
        const player = kazagumo.players.get(msg.guild.id);
        if (!player) return msg.reply('❌ Nothing playing!');

        if (!args[0]) return msg.reply(`🔊 Volume: **${player.volume}%**`);

        const vol = parseInt(args[0]);
        if (isNaN(vol) || vol < 0 || vol > 150) return msg.reply('❌ Volume: 0-150');

        player.setVolume(vol);
        msg.reply(`🔊 Volume: **${vol}%**`);
    }

    // ==================== SHUFFLE ====================
    if (cmd === 'shuffle') {
        const player = kazagumo.players.get(msg.guild.id);
        if (!player || player.queue.length < 2) return msg.reply('❌ Need 2+ songs!');
        player.queue.shuffle();
        msg.reply(`🔀 Shuffled ${player.queue.length} tracks!`);
    }

    // ==================== LOOP ====================
    if (cmd === 'loop') {
        const player = kazagumo.players.get(msg.guild.id);
        if (!player) return msg.reply('❌ Nothing playing!');

        const mode = args[0]?.toLowerCase();
        if (!['track', 'queue', 'off'].includes(mode)) {
            return msg.reply('Usage: `!loop track/queue/off`');
        }

        player.setLoop(mode === 'off' ? 'none' : mode);
        msg.reply(`🔁 Loop: **${mode}**`);
    }

    // ==================== HELP ====================
    if (cmd === 'help') {
        msg.reply(`
**🎵 Music:**
\`!play <song>\` - Play
\`!stop\` - Stop & leave
\`!skip\` - Skip
\`!pause\` / \`!resume\`
\`!queue\` - View queue
\`!np\` - Now playing
\`!vol <0-150>\` - Volume
\`!shuffle\` - Shuffle
\`!loop track/queue/off\`

**🔧 System:**
\`!nodes\` - Lavalink status
\`!setnode <name>\` - Switch node
\`!ping\` - Ping
        `);
    }
});

// ============ ERROR HANDLING ============
process.on('unhandledRejection', (err) => console.error('Unhandled:', err));

// ============ LOGIN ============
client.login(process.env.DISCORD_TOKEN);
