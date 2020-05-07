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
const columns = ["time","player","action","reason","victim","weapon","newteam","teamloss","message"];

const actions = [
  { name:"GameEntered", r: /(.*?) entered the game\.$/ },
  { name:"GameLeft", r: /(.*?) left the game\.$/ },
  { name:"TeamSwap", r: /(.*?) is now with (.*?)$/, subject:"newteam" },
  { name:"Death", r: /(.*?) fragged himself by accident...$/, attrs:{ reason:"Accident" } },
  { name:"Death", r: /(.*?) was blown to smitherines.$/, attrs:{ reason:"Explosion" } },
  { name:"Death", r: /(.*?) got run down by a Stray Vehicle$/, attrs:{ reason:"StrayVehicle" } },
  { name:"TrailerCapture", r: /(.*?) \: trailer has been captured! Driving to enemy base\!$/ },
  { name:"TrailerRestart", r: /Trailer has restarted$/ },
  { name:"FirstKill", r: /(.*?) has first kill\!$/ },
  { name:"Frag", r: /(.*?) blew (.*?) to smithereens.$/, subject:"victim", attrs:{ weapon:"Explosives" }  },
  { name:"Frag", r: /(.*?) gunned down (.*?).$/, subject:"victim", attrs:{ weapon:"Machinegun" }  },
  { name:"Frag", r: /(.*?) ran down (.*?) in a (.*?).$/, subject:"victim", attrs:{ weapon:"Roadkill" }  },
  { name:"Frag", r: /(.*?) was rocketed by (.*?).$/, subject:"victim", attrs:{ weapon:"Rocket" }  }, // TODO 1st is victim

  { name:"TrailerDelivered", r: /Trailer delivered to  (.*?) Squad$/, primary:"teamloss", playerOwner: true },
  { name:"TrailerExploded", r: /(.*?) BASE DESTROYED\!\!\!$/, playerOwner: true },
  { r: /You were killed by (.*?)$/ },

];


events.forEach( event => {
  // skip "Inactive" state events.
  if (event.Game.gc == "Rage.Inactive") { return; }
  if (event.Type == "Scorecheck") { return; } // deal with Scorecheck later.

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
      if (matches && /* matches[1] !== undefined &&  */ (!action.subject || matches[2] !== undefined)) {
         if (!action.name) { return; /* ignore action */ }
         let info = { action:action.name, player:matches[1], time:Number(event.Game.et) };
         if (action.playerOwner) { info.player = event.Msg.pn; }
         if (action.primary) { info[ action.primary ] = matches[1]; }
         if (action.subject) { info[ action.subject ] = matches[2]; }
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




