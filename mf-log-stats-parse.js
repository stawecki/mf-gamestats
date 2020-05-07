/************************************************************

Script for parsing raw JSON event logs into simple game events.



************************************************************/

const fs = require("fs");

let argVal = function( argName ) {
    var foundIndex = -1;
    process.argv.forEach(function(val, index, array) { if(val == "--"+argName) { foundIndex = index + 1; } });
    return process.argv[foundIndex];
}

const inFile = argVal("in");
const outFile = argVal("out") || "MFGameEvents.json";
const debug = argVal("debug");


if (!inFile || !outFile) {
    console.log("Missing parameters. Usage:")
    console.log("node mf-log-stats-parse --in MFLog.json --out MFGameEvents.json")
    process.exit(1);
}

const events = JSON.parse( ""+fs.readFileSync( inFile ) );
const unrecognised = [];
const processed = [];
const columns = ["time","player","action","reason","victim","weapon","newteam","teamloss","teamlead","vehicle","message"];

const rmapDefault = ["player"]; // mapping regex group matches to attributes.
const actions = [
  { name:"GameEntered", r: /(.*?) entered the game\.$/ },
  { name:"AdminLogin", r: /(.*?) became a server administrator\.$/ },
  { name:"GameLeft", r: /(.*?) left the game\.$/ },
  { name:"KillingMachine", r: /(.*?) is a one man killing machine\!$/ },
  { name:"TeamSwap", r: /(.*?) is now with (.*?)$/, rmap:["player","newteam"] },

  { name:"Death", r: /(.*?) fragged himself by accident...$/, attrs:{ reason:"Accident" } },
  { name:"Death", r: /(.*?) was blown to smitherines\.$/, attrs:{ reason:"Explosion" } },
  { name:"Death", r: /(.*?) got run down by a Stray Vehicle$/, attrs:{ reason:"StrayVehicle" } },
  { name:"Death", r: /(.*?) got run down by a stray Buggy$/, attrs:{ reason:"StrayVehicle", vehicle:"buggy" } },
  { name:"Death", r: /(.*?) got run down by a stray Truck$/, attrs:{ reason:"StrayVehicle", vehicle:"truck" } },
  { name:"Death", r: /(.*?) fell and killed himself\.$/, attrs:{ reason:"Fall" } },

  { name:"TrailerCapture", r: /(.*?) \: trailer has been captured! Driving to enemy base\!$/ },
  { name:"TrailerRestart", r: /Trailer has restarted$/ },
  { name:"FirstKill", r: /(.*?) has first kill\!$/ },

  { name:"Frag", r: /(.*?) blew (.*?) to smithereens.$/, attrs:{ weapon:"Explosives" }, rmap:["player","victim"] },
  { name:"Frag", r: /(.*?) gunned down (.*?).$/, attrs:{ weapon:"Machinegun" }, rmap:["player","victim"] },
  { name:"Frag", r: /(.*?) picked off (.*?).$/, attrs:{ weapon:"Sniper" }, rmap:["player","victim"] },
  { name:"Frag", r: /(.*?) blasted (.*?).$/, attrs:{ weapon:"Shotgun" }, rmap:["player","victim"] },
  { name:"Frag", r: /(.*?) tripped and detonated (.*?).$/, attrs:{ weapon:"Tripmine" }, rmap:["player","victim"] }, 

  { name:"SpreeEnd", r: /(.*?)\'s killing spree was abruptly ended by (.*?)$/ },

  { name:"Frag", r: /(.*?) ran down (.*?) in a (.*?).$/, attrs:{ weapon:"Roadkill" }, rmap:["player","victim","vehicle"] },
  { name:"Frag", r: /(.*?) was rocketed by (.*?).$/, attrs:{ weapon:"Rocket" }, rmap:["victim","player"] }, 

  { name:"TrailerDelivered", r: /Trailer delivered to  (.*?) Squad$/, rmap:["teamloss"], playerOwner: true },
  { name:"TrailerExploded", r: /(.*?)OBJECTIVE ACHIEVED! - (.*?) BASE DESTROYED\!\!\!$/, rmap:["","teamloss"], playerOwner: true },

  { name:"HoldoutSwitch", r: /(.*?) switched Holdout timer for (.*?) Squad$/, rmap:["player","teamlead"], playerOwner: true },

  { r: /You were killed by (.*?)$/ }, // local notification
  { r: /Commando Warfare\!$/ }, // local notification
  { r: /(.*?) frames rendered in (.*?)$/ }, // timedemo


];

let previous = null;
events.forEach( event => {
  // skip "Inactive" state events.
  if (event.Game.gc == "Rage.Inactive") { return; }
  if (event.Type == "Scorecheck") { return; } // deal with Scorecheck later.
  if (previous) {
    if (event.Msg.type == previous.Msg.type &&
        event.Msg.pn === previous.Msg.pn && 
        event.Msg.msg === previous.Msg.msg &&
        event.Game.et === previous.Game.et) {
      return; // duplicate
    }
  }
  previous = event;

  if (event.Msg) {
    // empty event (possibly start of match)
    if (event.Msg.type == "Console" || event.Msg.type == "None") { return; } 
    if (event.Msg.type == "Event" && event.Msg.pn === "" && event.Msg.msg === "") { return; } 
    if (event.Msg.type == "Event" && event.Msg.msg === "") { return; } 
    if (event.Msg.type == "TeamSay") { return; } // ignore TeamSay
    if (event.Msg.type == "Say") { 
      processed.push({ action:"Say", player:event.Msg.pn, time:Number(event.Game.et), message: event.Msg.msg });
      return; 
    }

    for (var action of actions) {
      let matches = action.r.exec( event.Msg.msg );
      if (matches) {
         if (!action.name) { return; /* ignore action */ }
         let info = { action:action.name, player:matches[1], time:Number(event.Game.et) };
         // map regex matches to attributes:
         let rmap = action.rmap || rmapDefault;
         for (var i = 0; i < rmap.length; i++) {
             var attr = rmap[i];
             if (attr !== "") {
               info[ attr ] = matches[ i + 1 ];              
             }
         }
         if (action.playerOwner) { info.player = event.Msg.pn; }
         if (action.attrs) { info = {...info, ...action.attrs}; }
         processed.push( info );
         return;
      }
    }
  }

  unrecognised.push(event);
})

if (unrecognised.length > 0) {
  console.log("!!! Unrecognised events: "+unrecognised.length);
  console.log( JSON.stringify(unrecognised[0], null, 2) );
  // console.log( JSON.stringify(unrecognised, null, 2) );
}

fs.writeFileSync( outFile, JSON.stringify(processed, null, 2) );

let csvArr = [ columns.join(",") ]
csvArr = csvArr.concat( processed.map( event => {
  return columns.map( column => event[column] ).join(",");
}))

fs.writeFileSync( outFile+".csv", csvArr.join("\n") );




