/************************************************************

Script for turning the MobileForces.log file with game event data into a JSON event list.
Each event 

{
  "Type": "Event", // stats log class "Event" (log game event), "Scorecheck" (score verification)
  "Score": [ // list of players - complete scorecard (state right before the event took place, before points are assigned)
    {
      "pn": "Joe", // Player name
      "s": "0.000000", // Score
      "d": "0.000000", // Deaths
      "tm": "0" // Team number (0 / 1)
    },
    {
      "pn": "Carter",
      "s": "1.000000",
      "d": "0.000000",
      "tm": "1"
    }
  ],
  "Game": {
    "gn": "Trailer", // Game name
    "gc": "RageGame.TrailerGame", // Game class
    "et": "87" // Elapsed time (seconds)
  },
  "Msg": {
    "type": "Event", // Message type. E.g. "Event" (game event), "Say" (chat), "TeamSay" (team chat), "DeathMessage" (usually anonymous death)
    "pn": "Joe", // Message's principal player (or sender)
    "msg": "Carter gunned down Joe." // Message text.
  }
}

************************************************************/

const fs = require("fs");

let argVal = function( argName ) {
    var foundIndex = -1;
    process.argv.forEach(function(val, index, array) { if(val == "--"+argName) { foundIndex = index + 1; } });
    return process.argv[foundIndex];
}

const inFile = argVal("in");
const outFile = argVal("out") || "MFLog.json";
const debug = argVal("debug");


if (!inFile || !outFile) {
    console.log("Missing parameters. Usage:")
    console.log("node mf-log-stats-events --in MobileForces.log --out MFLog.json")
    process.exit(1);
}

const logText = ""+fs.readFileSync( inFile );
const logLines = logText.split("\n").map( line => line.trim() );

const events = [];
let event;

logLines.forEach( line => {
  if ( line.indexOf("ScriptLog:") == 0 ) {
     line = line.substr(11);
     if (line.indexOf("---begin-") == 0) {
         event = { Type: line.substr(9) };
         events.push(event);
     } else if (line.indexOf("---item-") == 0 && event) {
         let key = line.substr(8, line.indexOf(" ")-8);
         let item = eval("("+ line.substr(line.indexOf(" ")+1)+")" );
         event[ key ] = event[ key ] || [];
         event[ key ].push(item);
     } else if (line.indexOf("---attr-") == 0 && event) {
         let key = line.substr(8, line.indexOf(" ")-8);
         event[ key ] = eval("("+ line.substr(line.indexOf(" ")+1)+")" );
     }
  }
})

fs.writeFileSync( outFile, JSON.stringify(events, null, 2) );
