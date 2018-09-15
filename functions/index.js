const http = require('http');
const express = require('express');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const bodyParser = require('body-parser');
const fetch = require("node-fetch");
const app = express();

 // Gloabals ----------------------------------------------------
const GEOCODER_APP_ID = "Lpl5KD8pKl3ricGxOAiV"
const GEOCODER_APP_CODE = "_u7OtzJaYftqN3-mJlcTGw"
const ORS_API_KEY = "5b3ce3597851110001cf62488da273b200ab4e2aa5124035dbe68e13"
const MAX_MESSAGE_LENGTH = 100

 // Helpers -----------------------------------------------------
 /**
  * Takes address, hits the HERE.com geocoder API, returns coordinates.
  * @param {*} address 
  */
let addressToCoords = async (address) => {
  let response = await fetch(`https://geocoder.api.here.com/6.2/geocode.json?app_id=${GEOCODER_APP_ID}&app_code=${GEOCODER_APP_CODE}&searchtext=${address}`)
  let json = await response.json()
  let coords = json["Response"]["View"][0]["Result"][0]["Location"]["NavigationPosition"][0]
  return coords              
}

/**
 * Takes coordinates, hit the ORS API and return a list of walking directions
 */
coordsToDirections = async (fromCoords, toCoords) => {
  query = `https://api.openrouteservice.org/directions?api_key=${ORS_API_KEY}&coordinates=${fromCoords["Longitude"]},${fromCoords["Latitude"]}|${toCoords["Longitude"]},${toCoords["Latitude"]}&profile=foot-walking`
  console.log(query)
  let response = await fetch(`https://api.openrouteservice.org/directions?api_key=${ORS_API_KEY}&coordinates=${fromCoords["Longitude"]},${fromCoords["Latitude"]}|${toCoords["Longitude"]},${toCoords["Latitude"]}&profile=foot-walking`)
  let json = await response.json()
  let directions = json["routes"][0]["segments"]
  let duration = json["routes"][0]["summary"]["duration"]
  return {"directions": directions, "duration":duration}
}

/**
 * Takes list of directions, drops two word instructions ("Keep straight" etc) and packs into SMS messages of 140 chars, without splitting/
 */
directionsToSMS = (directions) => {
  messages = []
  currentMessage = ""
  for (var stage in directions[0]["steps"]) {
    instruction = directions[0]["steps"][stage]["instruction"]
    if (instruction.split(' ').length > 3) {
      if ((currentMessage + "/n" + instruction).length < MAX_MESSAGE_LENGTH){
        currentMessage = currentMessage + "\n" + instruction
      }
      else{
        messages.push(currentMessage)
        currentMessage = instruction
      }
    }
  }
  messages.push(currentMessage)
  return messages
}

getName = (phoneNumber) => {
  return "Jerry"
}

// Route Handlers ------------------------------------------------
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/sms', async (req, res) => {
  const twiml = new MessagingResponse();

  var msgBody = req.body.Body
  var fromNumber = req.body.From
  var splitMsg = msgBody.split("=>")
  var fromLocation = splitMsg[0].split(' ').join("%20")
  var toLocation = splitMsg[1].split(' ').join("%20")

  let fromCoords = await addressToCoords(fromLocation)
  let toCoords = await addressToCoords(toLocation)

  let reply = await coordsToDirections(fromCoords, toCoords)

  userName = getName(fromNumber)

  welcomeMessage = `\nHey there ${userName},\n🚶 Welcome to Walkify 🚶 \n\nYour trip today should take about ${Math.round(reply["duration"]/60)} minutes.`
  twiml.message(welcomeMessage)

  messages = directionsToSMS(reply["directions"])

  // Send the directions themselves as a series of messages.
  for (i = 0; i < messages.length; i++) {
    content = `Message #${i+1}/${messages.length}\n\n${messages[i]}`
    twiml.message(content)
  } 

  twiml.message("Don't feel like walking? Too far?\n\n🚗Catch a Ride Instead!🚗\n\nReply UBER to order an Uber")

  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
});

http.createServer(app).listen(1337, () => {
  console.log('Express server listening on port 1337');
});
