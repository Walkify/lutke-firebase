const http = require('http');
const express = require('express');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const bodyParser = require('body-parser');

const app = express();

var fetch = require("node-fetch");

app.use(bodyParser.urlencoded({ extended: false }));

app.post('/sms', (req, res) => {
  const twiml = new MessagingResponse();

  //twiml.message('The Robots are coming! Head for the hills!');

  var msgBody = req.body.Body
  var splitMsg = msgBody.split(",")
  var fromLocation = splitMsg[0].split(' ').join("%20")
  var toLocation = splitMsg[1].split(' ').join("%20")
  let fromCoords;
  let toCoords;

  // TODO: need to substitute spaces foe underscores here.
  console.log(`https://geocoder.api.here.com/6.2/geocode.json?app_id=Lpl5KD8pKl3ricGxOAiV&app_code=_u7OtzJaYftqN3-mJlcTGw&searchtext=${fromLocation}`)

  // Geocode for the From location
  fetch(`https://geocoder.api.here.com/6.2/geocode.json?app_id=Lpl5KD8pKl3ricGxOAiV&app_code=_u7OtzJaYftqN3-mJlcTGw&searchtext=${fromLocation}`)
  .then(
    response => {
      if (response.status !== 200) {
        console.log('Looks like there was a problem. Status Code: ' +
          response.status);
        return;
      }
      // Examine the text in the response
      response.json().then(function(data) {
        fromCoords = data["Response"]["View"][0]["Result"][0]["Location"]["NavigationPosition"][0];
      });
    }
  )
  .catch(function(err) {
    console.log('Fetch Error :-S', err);
  });

  // Geocode for the To location
  fetch(`https://geocoder.api.here.com/6.2/geocode.json?app_id=Lpl5KD8pKl3ricGxOAiV&app_code=_u7OtzJaYftqN3-mJlcTGw&searchtext=${toLocation}`)
  .then(
    response => {
      if (response.status !== 200) {
        console.log('Looks like there was a problem. Status Code: ' +
          response.status);
        return;
      }
      // Examine the text in the response
      response.json().then(function(data) {
        toCoords = data["Response"]["View"][0]["Result"][0]["Location"]["NavigationPosition"][0];
        console.log(toCoords);
      });
    }
  )
  .catch(function(err) {
    console.log('Fetch Error :-S', err);
  });

  //var tmpCoords = {Latitude: 45.42055, Longitude: -75.69269}

  console.log(toCoords)

  twiml.message(`Lattitude is ${toCoords["Latitude"]} Your Longitude is ${toCoords["Longitude"]}`)

  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
});

http.createServer(app).listen(1337, () => {
  console.log('Express server listening on port 1337');
});
