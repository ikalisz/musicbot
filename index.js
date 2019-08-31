const Discord = require('discord.js')
const bot = new Discord.Client()
const express = require('express')
const app = express ()
const auth = require('./auth.json')
const ytdl = require('ytdl-core')

const queue = new Map()

let timeoutId = undefined

app.use(express.json())

bot.on('ready', () => {
    console.log('ready!')
})

bot.on('message', async (message) => {
    const {name} = message.channel.guild
    const serverQueue = queue.get(message.guild.id)
    if (message.author.bot) return;
    if (!message.content.startsWith(auth.prefix)) return 
    if (message.content === '!test') {
        console.log(bot.channels)
        console.log(message.channel.send('Hello world :ok_hand:'))
        console.log(message.guild.channels.get())
    }
    if (message.content.startsWith(`${auth.prefix}play`)) {
        execute(message, serverQueue)
        return
    } else if (message.content.startsWith(`${auth.prefix}skip`)) {
        skip(message, serverQueue)
        return
    } else if (message.content.startsWith(`${auth.prefix}stop`)) {
        stop(message, serverQueue)
        return
    } else {
        message.channel.send('You need to enter a valid command!')
    }
})


async function execute(message, serverQueue) {
    const args = message.content.split(' ') //splitting the command and url for song
    const voiceChannel = message.member.voiceChannel //grabbing the channel to join
    if (!voiceChannel) return message.channel.send('You need to be in a voice channel to play music!') //checking if user is in the channel
    const permissions = voiceChannel.permissionsFor(message.client.user) //grabbing permissions for the channel
    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
        return message.channel.send('I need permissions to join and speak in your voice channel!')
        //checking if the bot has permissions to join and play music
    }

    const songInfo = await ytdl.getInfo(args[1])
    const song = {
        title: songInfo.title,
        url: songInfo.video_url
    }
    //getting song info.
    if (timeoutId) return clearTimeout(timeoutId)
    if (!serverQueue) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true,
        }

        queue.set(message.guild.id, queueContruct)

        queueContruct.songs.push(song)

        try {
            var connection = await voiceChannel.join()
            queueContruct.connection = connection
            play(message.guild, queueContruct.songs[0])
        } catch (err) {
            console.log(err)
            queue.delete(message.guild.id)
            return message.channel.send('There was an error!')
        }
        message.react('👌')
    } else {
        serverQueue.songs.push(song)
        console.log(serverQueue.songs)
        return message.react('👌')
    }
}


function play(guild, song) {
    const serverQueue = queue.get(guild.id)
    if (!song) {
        leave(guild, serverQueue)
        return
    }
    const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
        .on('end', () => {
            console.log('Song ended')
            serverQueue.songs.shift()
            play(guild, serverQueue.songs[0])
        })
        .on('error', error => {
            console.error(error)
        })
        .on('start', () => {
            serverQueue.textChannel.send(`Now playing ${serverQueue.songs[0].title}`)
        })
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5)
}

function skip(message, serverQueue) {
    if (!message.member.voiceChannel) return message.channel.send('You have to be in a voice channel to skip!')
    if (!serverQueue) return message.channel.send('There is no song to skip')
    message.channel.send('Skipped!')
    serverQueue.connection.dispatcher.end()
}

function stop(message, serverQueue) {
    if (!message.member.voiceChannel) return message.channel.send('You have to be in a voice channel to stop music')
    serverQueue.songs = []
    message.channel.send('Stopping!')
    serverQueue.connection.dispatcher.end()
}

function leave(guild, serverQueue) {
    timeoutId = setTimeout(() =>{
        serverQueue.voiceChannel.leave()
        queue.delete(guild.id)
    }, 10000)
}

bot.login(auth.token)