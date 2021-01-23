var EVEoj = require("EVEoj");
var sddPath="./resources/data/static";
var SDD = EVEoj.SDD.Create("json", {path: sddPath});
var mapLoaded = false;
var map;

module.exports = class StarMap{
    constructor(){
        SDD.LoadMeta()
        .then(function() {
            map = EVEoj.map.Create(SDD, "K");
            return map.Load();
        })
        .then(function()
        {
            console.log("Map Loaded");
            mapLoaded=true;
        })
        .caught(function(err) {
            console.error(err);
        });
    }
    findRange(origin,target){
        try{
            var originSys = map.GetSystem({name: origin});
            var targetSys = map.GetSystem({name: target});
            var route = map.Route(originSys.ID, targetSys.ID, [], false, false);
            return route.length;
        } catch(err){
            return -1;
        }
    }
    findSystemID(systemName){
        try{
            return map.GetSystem({name: systemName}).ID;
        } catch (err){
            return -1;
        }
    }
    findSystemName(systemID){
        try{
            return map.GetSystem({id:systemID}).name;
        }catch(err){
            return "undefined";
        }
    }
    isLoaded(){
        return mapLoaded;
    }
}

//console.log(findRange("Jita","Amarr"));