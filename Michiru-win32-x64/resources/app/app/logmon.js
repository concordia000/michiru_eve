
const path = require('path');
const StarMap = require('./eveobquery.js')
const starmap = new StarMap();
// Load Eve MAP
const fs = require('fs');
const Tail = require('tail').Tail;
const events = require('events');

var logMonInterval = 0;
var logMonitor = null;

//Event emitter
var logMonAgent = new events.EventEmitter();
module.exports = logMonAgent;

//Wait for starmap initialisation
var waitForInit = setInterval(function () {
    if (starmap.isLoaded()) {
        clearInterval(waitForInit);
        logMonAgent.emit('mapInit', true);
    }
}
    , 100);

var localLogs = new Map();
var intelLogs = new Map();
var gameLogs = new Map();
//Define ClientLog class
class ClinetLog {
    constructor(type, logPath, channel) {
        this.path = logPath;
        this.type = type;
        this.channel = '';
        this.locID = 0;
        this.loc = "";
        if (type == "local") {//local Log initialisation
            var infos = new Array();
            var data = fs.readFileSync(logPath, { encoding: 'ucs2' });//Read each log sync; it is much easier to write it this way
            var lines = data.split('\n');
            lines.forEach(line => {
                infos.push(analyzeIntel(line, type, logPath));
            });
            //Filter empty elements from infos array
            infos = infos.filter(function (data) {
                return (data !== null);
            });
            for (var i = 0; i < infos.length; i++) {
                var element = infos[i];
                switch (element.action) {
                    case "newPilot":
                        this.channel = element.changes;//Channel name is listener name
                        break;
                    case "pilotMoved":
                        this.loc = element.changes[0];
                        this.locID = element.changes[1];
                        break;
                    default:
                        break;
                }
            }
            //Add the local log to list
            if (this.channel.length != 0) {
                //Now, construct and publish listener info
                publishInfo({
                    msg: this.channel + " > Detected at " + this.loc,
                    locationID: this.locID,
                    channel: this.channel,
                    action: "pilotUpdate",
                    date: infos[infos.length - 1].date
                });
            }
        } else if (type == "intel") {
            this.channel = channel;
        } else if (type == "game") {
            //TO be implemented
        }
        //Initialize listener
        this.tail = new Tail(logPath, { encoding: 'ucs2' });
        this.tail.watch();
        this.tail.on("line", function (data) {
            var info = analyzeIntel(data, type, logPath);
            if (info !== null) {
                if (info.type == "local") {
                    var log=localLogs.get(this.filename);
                    log.loc = info.changes[0];
                    log.locID = info.changes[1];
                    publishInfo({
                        msg: log.channel + " > Detected at " + log.loc,
                        locationID: log.locID,
                        channel: log.channel,
                        action: "pilotUpdate",
                        date: info.date
                    });
                } else if (info.type == "intel") {
                    var range = 999;
                    var targetPilot = "";
                    var origin = info.changes[0];
                    for (var log of localLogs.values()) {//iterate every local log to find nearest range
                        var pilot = log.channel;
                        var target = log.loc;
                        var r = starmap.findRange(origin, target);
                        if (r < range) {
                            range = r;
                            targetPilot = pilot;
                        }
                    }
                    publishInfo({
                        msg: origin + " > Enemy at " + range + " jumps from " + targetPilot,
                        innerMsg: info.changes[2],
                        range: range,
                        locationID: info.changes[1],
                        channel: intelLogs.get(info.logPath).channel,
                        action: "intelUpdate",
                        date: info.date
                    });
                }
            }
        });
    }
}
//Analyze intel
function analyzeIntel(data, type, logPath) {
    //Parse Intel
    var parseSuccess = false;
    var date = Date.now();
    var info = {//prepare default info object
        type: type,
        action: "",
        changes: null,//this field is used to carry action-specific informations, like pilot names.
        logPath: logPath,
        date: date
    };
    //check if it is a chat line
    if (data.indexOf('>') == -1) {
        //not chat line --- Parse user name
        if (type == "local") {//Parse listener information only if the log is a local chat log
            if (data.indexOf('Listener:        ') != -1) {
                parseSuccess = true;
                var pilot = data.replace('Listener:        ', '').trim();
                info.action = "newPilot";
                info.changes = pilot;
                console.log('Listener name:', pilot);
            }
            if (data.indexOf("  Channel ID:      (('solarsystemid2', ") != -1) {//Found Solar System ID information
                parseSuccess = true;
                var userLocID = parseInt(data.replace("  Channel ID:      (('solarsystemid2', ", ""));//parse system ID from local
                console.log('Listener Location', starmap.findSystemName(userLocID));
                info.action = "pilotMoved";
                info.changes = [starmap.findSystemName(userLocID), userLocID];//[SystemName, location ID]
            }
        }
    } else {
        try {
            //Parse chat message
            data = data.replace('*', '')//remove the annoying asterisk in some clients
                .replace('\r', '');//Remove CR
            var ignoredWords=['clear','clr','status'];
            var ignored = false;
            ignoredWords.forEach(word=>{
                if(data.includes(word)){
                    ignored = true;
                }
            });
            if(ignored){
                throw new Error('Message contains ignored words');
            }
            var words = data.split('>');
            var intelMsg = words[1];
            var intelTime = words[0];
            var intelWords = intelMsg.trim().split(' ');
            intelWords.forEach(element => {
                var elementID = starmap.findSystemID(element);
                if ((elementID != -1)) {
                    //system name found in chat
                    if (type == "local" && (intelTime.indexOf('EVE System') != -1)) {
                        parseSuccess = true;//People shit at local about star systems all the time
                        console.log("Listener location: " + element);//if it is a local system-change message
                        //localLog.setListenerLoc(elementID);//Update listenter location
                        info.action = "pilotMoved";
                        info.changes = [element, elementID];//Update pilot location in feed
                    } else {
                        if (type == "intel") {//Intel chat messages
                            parseSuccess = true;
                            info.action = "intelMsg";
                            info.changes = [element, elementID, data];
                        }
                    }
                }
            });
        } catch (err) {
            //no one cares
        }
    }
    if (!parseSuccess) {
        return null;
    } else {//Parse success
        if (info == undefined) {
            console.log('rekt');
        }
        return info;
    }
}

//Publish Intel
function publishInfo(info) {
    logMonAgent.emit(info.action, info);
}
//End of log parser

//var config={logFolder:'',watchLocal:true,watchGame:false,intelChannels:['delve.imperium','querious.imperium']}
//Beginning of log file monitor
class logMon {
    constructor(config) {
        this.config = config;
        this.running = true;
        console.log("Monitoring started");
        if (config.logFolder.length == 0) {//Default EVE log folder
            this.baseLogFolder = path.join(require('os').homedir(), '\\Documents\\EVE\\logs');
        } else {
            this.baseLogFolder = this.config.logFolder;
        }
        this.chatLogFolder = path.join(this.baseLogFolder, 'Chatlogs');
        this.gameLogFolder = path.join(this.baseLogFolder, 'Gamelogs');
        this.updateLogs(this);
        //reevaluation of occupied documents!!!!!!
    }
    updateLogs(logMon) {
        var chats = new Array();
        var chatChannels = new Array();
        var locals = new Array();
        var games = new Array();
        //Used intel channels
        //chats = this.chatLogPaths.concat(findLogs(this.chatLogFolder, config.intelChannels));
        chats = findLogs(logMon.chatLogFolder, logMon.config.intelChannels);
        chatChannels = chats.keyWords;
        chats = chats.logs;
        //construct an 1-d array from chats
        var flatChats = new Array();
        chats.forEach(subarray => {
            flatChats = flatChats.concat(subarray);
        });
        //Used Local logs
        if (this.config.watchLocal) {
            var logsFound=findLogs(logMon.chatLogFolder, 'Local').logs;
            if(logsFound.length==1){
                locals = locals.concat(logsFound[0]);
            }
        }
        //Used Game logs
        if (this.config.watchGame) {
            var logsFound=findLogs(logMon.gameLogFolder, 'Game').logs;
            if(logsFound.length==1){
                games = games.concat(logsFound[0]);
            }
        }
        //Filter out logs not used right now and delete them
        var freeIntelLogs = Array.from(intelLogs.keys()).filter((value) => { return !flatChats.includes(value); });
        var freeLocalLogs = Array.from(localLogs.keys()).filter((value) => { return !locals.includes(value); });
        var freeGameLogs = Array.from(gameLogs.keys()).filter((value) => { return !games.includes(value); });
        freeIntelLogs.forEach((entry) => {
            intelLogs.delete(entry);
        });
        freeLocalLogs.forEach((entry) => {
            localLogs.delete(entry);
        });
        freeGameLogs.forEach((entry) => {
            gameLogs.delete(entry);
        });
        //Filter out logs not in the monitored list and add them
        var newIntelLogs = flatChats.filter((value) => { return !Array.from(intelLogs.keys()).includes(value)});
        var newLocalLogs = locals.filter((value) => { return !Array.from(localLogs.keys()).includes(value) });
        var newGameLogs = games.filter((value) => { return !Array.from(gameLogs.keys()).includes(value) });
        newIntelLogs.forEach((entry) => {
            //Find respective intel channel names
            var oriIndex = flatChats.indexOf(entry);
            var channelFound = false;
            var i=0;
            while (!channelFound) {
                oriIndex-=chats[i].length;
                if(oriIndex>-1){//Not in this row
                    i++;
                }else{
                    channelFound = true;
                }
            }
            intelLogs.set(entry, new ClinetLog("intel", entry, chatChannels[i]));
        });
        newLocalLogs.forEach((entry) =>{
            localLogs.set(entry, new ClinetLog("local", entry, ""));
        });
        newGameLogs.forEach((entry) =>{
            gameLogs.set(entry, new ClinetLog("game", entry, ""));
        });
    }
    start() {
        for (var value in intelLogs.values()) {
            value.tail.watch();
        }
        for (var value in gameLogs.values()) {
            value.tail.watch();
        }
        for (var value in localLogs.values()) {
            value.tail.watch();
        }
        this.running = true;
    }
    stop() {
        for (var value in intelLogs.values()) {
            value.tail.unwatch();
        }
        for (var value in gameLogs.values()) {
            value.tail.unwatch();
        }
        for (var value in localLogs.values()) {
            value.tail.unwatch();
        }
        this.running = false;
    }
};
function checkOpened(logFolder, fileName) {
    try {
        fs.renameSync(path.join(logFolder, fileName), path.join(logFolder, 'MichiruTemp.tmp'));
    } catch (err) {//cannot lock the file
        if (err.code === "EBUSY") {
            return true;
        }
        return false;
    }
    try {
        fs.renameSync(path.join(logFolder, 'MichiruTemp.tmp'), path.join(logFolder, fileName));
    } catch (err) {
        //Doesn't really care
    }
    return false;
}
/* node.js is not able to detect whether file is used by EVE Client. A compromise is possible, by letting 
the program to read all intel logs and choose the newest one. To track characters, the program
will read character names from recent logs (last 24 hrs), and then follows the newest logs.

EDIT: Rename works like a charm
*/

function findLogs(logFolder, keyWords) {
    var logLists = new Array();
    var logs = fs.readdirSync(logFolder);
    var kw = new Array().concat(keyWords);
    kw.forEach(keyWord => {
        var logList = new Array();
        var activeLogFound = false;
        var filteredLogs = logs.filter((log) => { return log.includes(keyWord); });
        filteredLogs.forEach(logName => {
            if (checkOpened(logFolder, logName)) {//if log is used by client
                activeLogFound = true;
                logList.push(path.join(logFolder, logName));
            }
        });
        if (activeLogFound) {
            logLists.push(logList);
        } else {
            kw.splice(kw.indexOf(keyWord), 1);//remove keyword from index
        }
    });
    return { logs: logLists, keyWords: kw };
}

//Register events on the event handler
logMonAgent.on("start", (config) => {
    if (logMonitor == null) {
        logMonitor = new logMon(config);
    } else {
        logMonitor.start();
    }
    logMonInterval=setInterval(()=>{logMonitor.updateLogs(logMonitor);},7500);
});
logMonAgent.on("stop", () => {
    if (logMonitor != null) {
        logMonitor.stop();
        logMonitor == null;//Clear log monitor
        clearInterval(logMonInterval);
    }
});
