// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
const { ipcRenderer, remote } = require('electron');
const intelTemplate = $('#intel-template');
const infoTemplate = $('#info-template');
var intelCounter = 0;
var infoCounter = 0;
var config;

ipcRenderer.on('intelUpdate', (event, info) => {
    intelCounter++;
    var newCard = intelTemplate.clone();
    newCard.attr("id", "intel-" + intelCounter);
    newCard.find('.card-title').text(info.msg);
    newCard.find('.card-subtitle').text(info.channel);
    newCard.find('.card-text').text(info.innerMsg);
    //console.log(config);
    if (info.range <= config.dangerRange && info.range >= 0) {
        newCard.find('.card-title').addClass('text-danger');
        intelAlert(intelCounter, "danger");
    } else if (info.range <= config.warningRange) {
        newCard.find('.card-title').addClass('text-warning');
        intelAlert(intelCounter, "warning");
    }
    newCard.find('.intel-collapse-btn').click(function () { $(this).siblings('.collapse').collapse('toggle'); });
    $('#intel-feed').prepend(newCard);
    $("#intel-" + intelCounter).slideDown();
});
ipcRenderer.on('pilotUpdate', (event, info) => {
    infoCounter++;
    var newCard = infoTemplate.clone();
    newCard.attr("id", "info-" + infoCounter);
    newCard.find('.card-title').text(info.msg);
    newCard.find('.card-subtitle').text(info.channel);
    newCard.find('.card-title').addClass('text-success');
    $('#intel-feed').prepend(newCard);
    $("#info-" + infoCounter).slideDown();
});
ipcRenderer.on('init', (event, data) => {
    config = data;
});

$('#window-minimise-btn').click(() => { remote.getCurrentWindow().minimize() });
$('.intel-collapse-btn').click(function () { $(this).siblings('.collapse').collapse('toggle'); });
$('#app-close-btn').click(() => { remote.getCurrentWindow().close() });
$('#monitor-start-btn').click(() => {
    ipcRenderer.send('monitor-start');
    $('#title-bar').addClass('active');
    $('#monitor-start-btn').hide();
    $('#monitor-stop-btn').show();
});
$('#monitor-stop-btn').click(() => {
    ipcRenderer.send('monitor-stop');
    $('#title-bar').removeClass('active');
    $('#monitor-start-btn').show();
    $('#monitor-stop-btn').hide();
});
function intelAlert(id, state) {
    switch (state) {
        case "danger":
            $('#danger-sound')[0].play();
            break;
        case "warning":
            $('#warning-sound')[0].play();
            break;
        case "info":
            $('#info-sound')[0].play();
    }
}
