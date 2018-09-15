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

 // Helpers -----------------------------------------------------
let addressToCoords = async (address) => {
  let response = await fetch(`https://geocoder.api.here.com/6.2/geocode.json?app_id=${GEOCODER_APP_ID}&app_code=${GEOCODER_APP_CODE}&searchtext=${address}`)
  let json = await response.json()
  let coords = json["Response"]["View"][0]["Result"][0]["Location"]["NavigationPosition"][0]
  return coords              
}

coordsToDirections = async (fromCoords, toCoords) => {
  query = `https://api.openrouteservice.org/directions?api_key=${ORS_API_KEY}&coordinates=${fromCoords["Longitude"]},${fromCoords["Latitude"]}|${toCoords["Longitude"]},${toCoords["Latitude"]}&profile=foot-walking`
  console.log(query)
  let response = await fetch(`https://api.openrouteservice.org/directions?api_key=${ORS_API_KEY}&coordinates=${fromCoords["Longitude"]},${fromCoords["Latitude"]}|${toCoords["Longitude"]},${toCoords["Latitude"]}&profile=foot-walking`)
  let json = await response.json()
  let directions = json["routes"][0]["segments"]
  return directions
}

// Route Handlers ------------------------------------------------
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/sms', async (req, res) => {
  const twiml = new MessagingResponse();

  var msgBody = req.body.Body
  var splitMsg = msgBody.split(",")
  var fromLocation = splitMsg[0].split(' ').join("%20")
  var toLocation = splitMsg[1].split(' ').join("%20")

  let fromCoords = await addressToCoords(fromLocation)
  let toCoords = await addressToCoords(toLocation)

  let directions = await coordsToDirections(fromCoords, toCoords)

  console.log(directions[0]["steps"])

  //var tmpCoords = {Latitude: 45.42055, Longitude: -75.69269}

  for (var stage in directions[0]["steps"]) {
    console.log(directions[0]["steps"][stage]["instruction"]);
    twiml.message(directions[0]["steps"][stage]["instruction"])
  }

  twiml.message(`Lattitude is ${toCoords["Latitude"]} Your Longitude is ${toCoords["Longitude"]}`)

  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
});

http.createServer(app).listen(1337, () => {
  console.log('Express server listening on port 1337');
});
