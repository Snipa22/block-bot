"use strict";
let fs = require("fs");
let config = JSON.parse(fs.readFileSync("./config.json"));
let request_json = require('request-json');
let request = require('request');
let irc = require("irc");
let debug = require("debug")("ircbot");
let zlib = require("zlib");

let bot = new irc.Client(config.irc.server, config.irc.nick, config.irc.config);

function nodejs_pool_bot(site, url){
    let client = request_json.createClient(url);
    client.get('pool/blocks', function(err, res, body){
        if (err){
            console.error(err);
        } else {
            if (body.length > 0 && body[0].height > config.hosts[site].last_block_id){
                debug(site + " is at height: " + body[0].height);
                if (config.hosts[site].last_block_id !== 0){
                    let utc_find = new Date(body[0].ts);
                    config.irc.config.channels.forEach(function(channel){
                        let text_string = "Block " + body[0].height.toString() + " found on "+site+" approximately "+ (Math.floor(Date.now() / 1000) - Math.floor(body[0].ts / 1000)).toString() + " seconds ago at "+utc_find.toUTCString()+" on the " + body[0].pool_type + " pool!";
                        bot.say(channel, text_string);
                    });
                }
                config.hosts[site].last_block_id = body[0].height;
            }
        }
        setTimeout(nodejs_pool_bot, 15000, site, url);
    });
}

function handle_cn_data(err, res, site){
    if (err){
        console.error(err);
    } else {
        let body = JSON.parse(res);
        let blocks = body.pool.blocks;
        if (blocks.length > 1){
            let best_block_data = "";
            let best_block = 0;
            while (blocks.length >0){
                let block_data = blocks.shift();
                let block_height = parseInt(blocks.shift());
                if (block_height > best_block){
                    best_block = block_height;
                    best_block_data = block_data;
                }
                if (blocks.length === 0){
                    debug(site + " is at height: " + best_block.toString());
                    if (best_block > config.hosts[site].last_block_id && config.hosts[site].last_block_id !== 0){
                        let block_data = best_block_data.split(':');
                        let utc_find = new Date(parseInt(block_data[1])*1000);
                        config.irc.config.channels.forEach(function(channel){
                            let text_string = "Block " + best_block.toString() + " found on "+site+" approximately "+ (Math.floor(Date.now() / 1000) - parseInt(block_data[1])).toString() + " seconds ago at "+utc_find.toUTCString()+"!";
                            bot.say(channel, text_string);
                        });
                    }
                    config.hosts[site].last_block_id = best_block;
                }
            }
        }
    }
}

function cn_pool_bot(site, url){
    request({url: url+'stats',encoding: null}, function(err, res, body){
        if (err){
            console.error(err);
        } else {
            try {
                JSON.parse(body.toString());
                handle_cn_data(null, body.toString(), site);
            } catch (err){
                try {
                    body = zlib.inflateRawSync(body).toString();
                    JSON.parse(body);
                    handle_cn_data(null, body, site);
                } catch (err2){
                    console.log(site + " is not returning valid data.  Disabling it");
                    return;
                }
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
