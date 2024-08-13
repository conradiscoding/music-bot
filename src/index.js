require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const axios = require('axios');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const queue = new Map();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const serverQueue = queue.get(message.guild.id);

    if (message.content.startsWith('!play')) {
        const searchQuery = message.content.replace('!play', '').trim();
        if (!searchQuery) {
            message.channel.send('Please provide a song name or link.');
            return;
        }
        execute(message, serverQueue, searchQuery);
    } else if (message.content.startsWith('!skip')) {
        skip(message, serverQueue);
    } else if (message.content.startsWith('!stop')) {
        stop(message, serverQueue);
    }
});

async function execute(message, serverQueue, searchQuery) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.channel.send('You need to be in a voice channel to play music!');

    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
        return message.channel.send('I need the permissions to join and speak in your voice channel!');
    }

    let songInfo;
    try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                part: 'snippet',
                q: searchQuery,
                type: 'video',
                key: YOUTUBE_API_KEY,
            },
        });

        const video = response.data.items[0];
        const videoUrl = `https://www.youtube.com/watch?v=${video.id.videoId}`;
        songInfo = await ytdl.getInfo(videoUrl);

    } catch (error) {
        console.error(error);
        return message.channel.send('There was an error searching for the song.');
    }

    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
    };

    if (!serverQueue) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            player: createAudioPlayer(),
            playing: true
        };

        queue.set(message.guild.id, queueContruct);

        queueContruct.songs.push(song);

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });
            queueContruct.connection = connection;

            play(message.guild, queueContruct.songs[0]);
        } catch (err) {
            console.error(err);
            queue.delete(message.guild.id);
            return message.channel.send('There was an error connecting to the voice channel.');
        }
    } else {
        serverQueue.songs.push(song);
        return message.channel.send(`${song.title} has been added to the queue!`);
    }
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel) return message.channel.send('You have to be in a voice channel to skip the music!');
    if (!serverQueue) return message.channel.send('There is no song that I could skip!');
    serverQueue.player.stop();
}

function stop(message, serverQueue) {
    if (!message.member.voice.channel) return message.channel.send('You have to be in a voice channel to stop the music!');
    if (!serverQueue) return message.channel.send('There is no song that I could stop!');
    serverQueue.songs = [];
    serverQueue.player.stop();
    serverQueue.connection.destroy();
    queue.delete(message.guild.id);
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.connection.destroy();
        queue.delete(guild.id);
        return;
    }
console.log(song);
    const stream = ytdl(song.url,
         { filter: "audioonly",
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
        videoDuration: "medium",
     }
    );
    console.log(stream);
    const resource = createAudioResource(stream);
    serverQueue.player.play(resource);

    serverQueue.player.on(AudioPlayerStatus.Idle, () => {
        serverQueue.songs.shift();
        play(guild, serverQueue.songs[0]);
    });

    serverQueue.connection.subscribe(serverQueue.player);
    serverQueue.textChannel.send(`Now playing: **${song.title}**`);
}

client.login(DISCORD_TOKEN);
