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

// ============ LAVALINK NODES (ALL ONLINE - BEST SELECTION) ============
const Nodes = [
    // ⭐ #1 - SerenetiaV4 SSL (100% Uptime!) - BEST CHOICE
    {
        name: 'SerenetiaV4',
        url: 'lavalinkv4.serenetia.com:443',
        auth: 'https://dsc.gg/ajidevserver',
        secure: true
    },
    // #2 - Serenetia Combined (84.49% Uptime)
    {
        name: 'SerenetiaCombined',
        url: 'lavalink.serenetia.com:443',
        auth: 'https://dsc.gg/ajidevserver',
        secure: true
    },
    // #3 - AjieBlogs V4 SSL
    {
        name: 'AjieBlogsV4',
        url: 'lava-v4.ajieblogs.eu.org:443',
        auth: 'https://dsc.gg/ajidevserver',
        secure: true
    },
    // #4 - Muzykant V4 SSL
    {
        name: 'MuzykantV4',
        url: 'lavalink_v4.muzykant.xyz:443',
        auth: 'https://discord.gg/v6sdrD9kPh',
        secure: true
    },
    // #5 - Aiko Project (Non-SSL) - Has many plugins!
    {
        name: 'AikoProject',
        url: 'lavalink.aiko-project.xyz:2333',
        auth: 'Rikka',
        secure: false
    },
    // #6 - Millohost IP (Non-SSL)
    {
        name: 'Millohost1',
        url: '107.150.58.122:4006',
        auth: 'https://discord.gg/mjS5J2K3ep',
        secure: false
    },
    // #7 - Millohost IP 2 (Non-SSL)
    {
        name: 'Millohost2',
        url: '5.39.63.207:8893',
        auth: 'https://discord.gg/mjS5J2K3ep',
        secure: false
    },
    // #8 - Your Personal Render Server (BACKUP)
    {
        name: 'MyRender',
        url: process.env.LAVALINK_HOST || 'lavalink-sf9r.onrender.com:443',
        auth: process.env.LAVALINK_PASSWORD || 'your_super_strong_password_here',
        secure: true
    },
    // #9 - SerenetiaV3 SSL (97.97% Uptime) - Fallback
    {
        name: 'SerenetiaV3',
        url: 'lavalinkv3.serenetia.com:443',
        auth: 'https://dsc.gg/ajidevserver',
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
        moveOnDisconnect: true,
        resumable: true,
        resumableTimeout: 30,
        reconnectTries: 5,
        reconnectInterval: 5000,
        restTimeout: 60000
    }
);

// ============ PREFERRED NODE ============
let preferredNode = 'auto';

// ============ LAVALINK EVENTS ============
kazagumo.shoukaku.on('ready', (name) => console.log(`✅ [${name}] Connected!`));
kazagumo.shoukaku.on('error', (name, err) => console.log(`❌ [${name}] Error: ${err.message}`));
kazagumo.shoukaku.on('close', (name, code, reason) => console.log(`🔴 [${name}] Closed - Code: ${code}`));
kazagumo.shoukaku.on('disconnect', (name) => console.log(`⚠️ [${name}] Disconnected`));
kazagumo.shoukaku.on('reconnecting', (name) => console.log(`🔄 [${name}] Reconnecting...`));

// ============ PLAYER EVENTS ============
kazagumo.on('playerStart', (player, track) => {
    const ch = client.channels.cache.get(player.textId);
    if (ch) {
        ch.send(`🎵 **Now Playing:** ${track.title}\n👤 Artist: ${track.author || 'Unknown'}\n🔗 <${track.uri}>`);
    }
});

kazagumo.on('playerEmpty', (player) => {
    const ch = client.channels.cache.get(player.textId);
    if (ch) ch.send('⏹️ Queue selesai!');
    player.destroy();
});

kazagumo.on('playerError', (player, err) => {
    console.log('Player error:', err);
    const ch = client.channels.cache.get(player.textId);
    if (ch) ch.send('❌ Error, skipping...');
});

// ============ BOT READY ============
client.on('ready', async () => {
    console.log('═'.repeat(50));
    console.log(`🤖 ${client.user.tag} online!`);
    console.log(`📊 ${client.guilds.cache.size} servers`);
    console.log(`🎵 Nodes: ${Nodes.map(n => n.name).join(', ')}`);
    console.log('═'.repeat(50));
    
    // Wait for nodes to connect
    console.log('⏳ Waiting for nodes to connect...');
    await new Promise(r => setTimeout(r, 8000));
    
    const nodes = getNodeStatus();
    const online = nodes.filter(n => n.online);
    console.log(`✅ ${online.length}/${nodes.length} nodes connected!`);
    online.forEach(n => console.log(`   🟢 ${n.name}`));
    
    client.user.setActivity('!help | Music Bot', { type: 2 });
});

// ============ HELPERS ============
function getNodeStatus() {
    const result = [];
    kazagumo.shoukaku.nodes.forEach((node, name) => {
        const states = ['🟡 Connecting', '🟡 Nearly', '🟢 Online', '🟡 Reconnecting', '🔴 Disconnecting', '🔴 Offline'];
        result.push({
            name,
            status: states[node.state] || '❓ Unknown',
            online: node.state === 2,
            stats: node.stats
        });
    });
    return result;
}

function getOnlineNode() {
    const nodes = getNodeStatus();
    
    if (preferredNode !== 'auto') {
        const preferred = nodes.find(n => n.name.toLowerCase() === preferredNode.toLowerCase() && n.online);
        if (preferred) return preferred.name;
    }
    
    // Priority order: SerenetiaV4 > SerenetiaCombined > others
    const priority = ['SerenetiaV4', 'SerenetiaCombined', 'AjieBlogsV4', 'MuzykantV4', 'AikoProject'];
    for (const name of priority) {
        const node = nodes.find(n => n.name === name && n.online);
        if (node) return node.name;
    }
    
    const online = nodes.find(n => n.online);
    return online ? online.name : null;
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
        const nodes = getNodeStatus();
        let text = '**🎵 Lavalink Nodes Status:**\n\n';
        
        nodes.forEach(n => {
            const star = preferredNode.toLowerCase() === n.name.toLowerCase() ? ' ⭐' : '';
            text += `**${n.name}${star}:** ${n.status}\n`;
            if (n.stats && n.online) {
                text += `└ Players: ${n.stats.players || 0} | Mem: ${Math.round((n.stats.memory?.used || 0)/1024/1024)}MB\n`;
            }
        });
        
        const online = nodes.filter(n => n.online).length;
        text += `\n**Online:** ${online}/${nodes.length} nodes`;
        text += `\n**Mode:** \`${preferredNode}\``;
        text += `\n💡 \`!setnode <name/auto>\` to switch`;
        
        return msg.reply(text);
    }

    // ==================== SETNODE ====================
    if (cmd === 'setnode' || cmd === 'node') {
        const nodeName = args[0]?.toLowerCase();
        
        if (!nodeName) {
            const nodes = getNodeStatus();
            let text = '**📡 Available Nodes:**\n\n';
            nodes.forEach(n => {
                text += `• \`${n.name.toLowerCase()}\` - ${n.status}\n`;
            });
            text += `• \`auto\` - Auto select best\n\n`;
            text += `**Current:** \`${preferredNode}\`\n`;
            text += `**Usage:** \`!setnode serenetiav4\``;
            return msg.reply(text);
        }
        
        const validNodes = [...Nodes.map(n => n.name.toLowerCase()), 'auto'];
        
        if (!validNodes.includes(nodeName)) {
            return msg.reply(`❌ Invalid!\n\nAvailable: ${validNodes.join(', ')}`);
        }
        
        preferredNode = nodeName;
        
        const nodes = getNodeStatus();
        const targetOnline = nodeName === 'auto' 
            ? nodes.some(n => n.online)
            : nodes.find(n => n.name.toLowerCase() === nodeName)?.online;
        
        return msg.reply(`✅ Node: **${nodeName}** ${targetOnline ? '🟢' : '🔴'}\n\n${targetOnline ? 'Ready to play!' : '⚠️ Node offline, will use fallback.'}`);
    }

    // ==================== PLAY ====================
    if (cmd === 'play' || cmd === 'p') {
        if (!msg.member.voice.channel) {
            return msg.reply('❌ Join voice channel dulu!');
        }

        const query = args.join(' ');
        if (!query) {
            return msg.reply('❌ Contoh: `!play never gonna give you up`');
        }

        let activeNode = getOnlineNode();
        
        // Retry logic if no node available
        if (!activeNode) {
            const waitMsg = await msg.reply('⏳ Connecting to nodes...');
            await new Promise(r => setTimeout(r, 5000));
            activeNode = getOnlineNode();
            
            if (!activeNode) {
                return waitMsg.edit('❌ Semua node offline!\n\n💡 Tips:\n• `!nodes` - Cek status\n• Tunggu 30 detik, coba lagi\n• `!setnode serenetiav4`');
            }
            await waitMsg.delete().catch(() => {});
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

            const searchMsg = await msg.reply(`🔍 Searching: **${query}**\n📡 Node: ${activeNode}`);
            
            const result = await kazagumo.search(query, { requester: msg.author });
            
            if (!result?.tracks?.length) {
                return searchMsg.edit('❌ Not found!');
            }

            if (result.type === 'PLAYLIST') {
                for (const track of result.tracks) player.queue.add(track);
                searchMsg.edit(`📃 Added **${result.tracks.length}** tracks from **${result.playlistName}**`);
            } else {
                const track = result.tracks[0];
                player.queue.add(track);
                
                if (!player.playing && !player.paused) {
                    player.play();
                    searchMsg.edit(`✅ Playing: **${track.title}**`);
                } else {
                    searchMsg.edit(`➕ Added: **${track.title}** (#${player.queue.length})`);
                }
            }

            if (!player.playing && !player.paused) player.play();

        } catch (error) {
            console.error('Play error:', error);
            msg.reply(`❌ Error: ${error.message}\n\n💡 Coba:\n• \`!setnode serenetiav4\`\n• \`!nodes\` cek status`);
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
        if (!player?.queue.current) return msg.reply('❌ Queue empty!');

        let text = `🎵 **Now:** ${player.queue.current.title}\n`;
        if (player.queue.length > 0) {
            text += `\n📋 **Next (${player.queue.length}):**\n`;
            player.queue.slice(0, 5).forEach((t, i) => text += `${i+1}. ${t.title}\n`);
            if (player.queue.length > 5) text += `...+${player.queue.length - 5} more`;
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
        if (isNaN(vol) || vol < 0 || vol > 150) return msg.reply('❌ 0-150 only');
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
        if (!['track', 'queue', 'off'].includes(mode)) return msg.reply('Usage: `!loop track/queue/off`');
        player.setLoop(mode === 'off' ? 'none' : mode);
        msg.reply(`🔁 Loop: **${mode}**`);
    }

    // ==================== HELP ====================
    if (cmd === 'help') {
        msg.reply(`
**🎵 Music Commands:**
\`!play <song>\` - Play music
\`!stop\` - Stop & leave
\`!skip\` - Skip track
\`!pause\` / \`!resume\`
\`!queue\` - View queue
\`!np\` - Now playing
\`!vol <0-150>\` - Volume
\`!shuffle\` / \`!loop\`

**🔧 System:**
\`!nodes\` - Node status
\`!setnode <name>\` - Switch node
\`!ping\` - Latency
        `);
    }
});

// ============ ERROR HANDLING ============
process.on('unhandledRejection', (err) => console.error('Unhandled:', err));

// ============ LOGIN ============
client.login(process.env.DISCORD_TOKEN);
