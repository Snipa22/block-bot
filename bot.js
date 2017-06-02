"use strict";
let fs = require("fs");
let config = JSON.parse(fs.readFileSync("./config.json"));
let request = require('request-json');
let irc = require("irc");
let debug = require("debug")("ircbot");

let bot = new irc.Client(config.irc.server, config.irc.nick, config.irc.config);

function nodejs_pool_bot(site, url){
    let client = request.createClient(url);
    client.get('pool/blocks', function(err, res, body){
        if (err){
            console.error(err);
        } else {
            if (body.length > 0 && body[0].height > config.hosts[site].last_block_id){
                debug(site + " is at height: " + body[0].height);
                if (config.hosts[site].last_block_id !== 0){
                    config.irc.config.channels.forEach(function(channel){
                        let text_string = "Block " + body[0].height + " found on "+site+" approximately "+ Math.floor(Date.now() / 1000) - Math.floor(body[0].ts / 1000) + " seconds ago on the " + body[0].pool_type + " pool!";
                        bot.say(channel, text_string);
                    });
                }
                config.hosts[site].last_block_id = body[0].height;
            }
        }
        setTimeout(nodejs_pool_bot, 15000, site, url);
    });
}

function cn_pool_bot(site, url){
    let client = request.createClient(url);
    client.get('get_blocks?height=999999999', function(err, res, body){
        if (err){
            console.error(err);
        } else {
            let blocks = body;
            if (Object.keys(blocks).length > 1){
                let block_height = parseInt(blocks[1]);
                debug(site + " is at height: " + block_height);
                if (block_height > config.hosts[site].last_block_id && config.hosts[site].last_block_id !== 0){
                    let block_data = blocks[0].split(':');
                    config.irc.config.channels.forEach(function(channel){
                        let text_string = "Block " + block_height + " found on "+site+" approximately "+ Math.floor(Date.now() / 1000) - parseInt(block_data[1]) + " seconds ago!";
                        bot.say(channel, text_string);
                    });
                }
                config.hosts[site].last_block_id = block_height;
            }
        }
        setTimeout(cn_pool_bot, 15000, site, url);
    });
}

Object.keys(config.hosts).forEach(function(host){
    if (!config.hosts[host].enabled){
        return;
    }
    debug("Initalizing " + host + " with API base: " + config.hosts[host].api);
    switch (config.hosts[host].type){
        case 'nodejs-pool':
            nodejs_pool_bot(host, config.hosts[host].api);
            break;
        case 'node-cn-pool':
            cn_pool_bot(host, config.hosts[host].api);
            break;
    }
});
