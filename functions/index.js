const http = require('http');
const express = require('express');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const bodyParser = require('body-parser');
const fetch = require("node-fetch");
const app = express();
const formData = require("form-data")

// Firebase Config ---------------------------------------------
var admin = require("firebase-admin");
var serviceAccount = require("./walkify-50afe-firebase-adminsdk-dmhwq-3fdfa8972b.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://walkify-50afe.firebaseio.com"
});

let db = admin.database();
let dbRef = db.ref("users");
let ref = db.ref();
let usersRef = ref.child("users");


 // Globals ----------------------------------------------------
const GEOCODER_APP_ID = process.env.GEOCODER_APP_ID;
const GEOCODER_APP_CODE = process.env.GEOCODER_APP_CODE
const ORS_API_KEY = process.env.ORS_API_KEY
const UBER_SERVER_TOKEN = process.env.UBER_SERVER_TOKEN
const UBER_API_URL = "https://sandbox-api.uber.com/v1.2"
const MAX_MESSAGE_LENGTH = 110  // Determines the maximum characters in a message (Set to 140 in production)

console.log(GEOCODER_APP_CODE)
console.log(GEOCODER_APP_ID)
console.log(ORS_API_KEY)
console.log(UBER_SERVER_TOKEN)


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

getUberToken = (phoneNumber) => {
  return "aV2-ngv_423bZyLlNBfZ6iUEVoDNESdN"
}

/**
 * Hits the Uber API and gets a cost quote (Defaults to UberX)
 */
getCostQuote = async (fromCoords, toCoords) => {
  const settings = {"Authorization": `Token ${UBER_SERVER_TOKEN}`, "Accept-Language": "en_US", "Content-Type":"application/json"}
  let response = await fetch(`${UBER_API_URL}/estimates/price?start_longitude=${fromCoords["Longitude"]}&end_latitude=${toCoords["Latitude"]}&end_longitude=${toCoords["Longitude"]}&start_latitude=${fromCoords["Latitude"]}`, {headers: settings})
  // Parse response to get Cost estimate
  let json = await response.json()
  let uberX =  json.prices.find( el => el.localized_display_name === 'UberX')

  return uberX.estimate
}

/**
 * Hits the Uber API and gets a time estimate.
 */
getTimeQuote = async (fromCoords) => {
  const settings = {"Authorization":  `Token ${UBER_SERVER_TOKEN}`, "Accept-Language": "en_US", "Content-Type":"application/json"}
  let response = await fetch(`${UBER_API_URL}/estimates/time?start_longitude=${fromCoords["Longitude"]}&start_latitude=${fromCoords["Latitude"]}`, {headers: settings})
  // Parse response to get time estimate
  let json = await response.json()
  let uberX = json.times.find( el => el.localized_display_name === 'UberX')

  return uberX.estimate
}

/**
 * 
 */
getUberEstimate = async (fromCoords, toCoords, ClientToken) => {
  const settings = {"Authorization":  `Bearer ${ClientToken}`, "Content-Type":"application/json"}
  const requestBody = {"start_latitude":fromCoords["Latitude"], "start_longitude":fromCoords["Longitude"], "end_latitude":toCoords["Latitude"], "end_longitude":toCoords["Longitude"] }
  let response = await fetch(`${UBER_API_URL}/requests/estimate`, {method: 'POST', headers: settings, body: JSON.stringify(requestBody)})
  console.log(response)
  let json = await response.json()
  console.log(json)
  let fareID = json.fare.fare_id
  return fareID
}

requestUber = async (fromCoords, toCoords, ClientToken, fareID) => {
  const settings = {"Authorization":  `Bearer ${ClientToken}`, "Content-Type":"application/json"}
  const requestBody = {"start_latitude":fromCoords["Latitude"], "start_longitude":fromCoords["Longitude"], "end_latitude":toCoords["Latitude"], "end_longitude":toCoords["Longitude"], "fare_id":fareID}
  let response = await fetch(`${UBER_API_URL}/requests`, {method: 'POST', headers: settings, body: JSON.stringify(requestBody)})
  //console.log(response)

  let json = await response.json()

  console.log(json)
  return json.driver
}

writeUserData = (userId, name, email, imageUrl) => {
    firebase.database().ref('users/' + userId).set({
      username: name,
      email: email,
      profile_picture : imageUrl
    });
  }

function updateState(userID, newState){
    var updates = {}
    updates["/users/" + userID + "/state"] = newState
    admin.database().ref().update(updates); 
    return admin.database().ref().update(updates);
}

function updateToFrom(userID, toCoords, fromCoords){
    var updates = {}
    updates["/users/" + userID + "/to"] = toCoords
    updates["/users/" + userID + "/from"] = fromCoords
    admin.database().ref().update(updates); 
    return admin.database().ref().update(updates);
}

// Route Handlers ------------------------------------------------
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/sms', async (req, res) => {
    const twiml = new MessagingResponse();

// if(sender.toFrom == null) {
    let msgBody = req.body.Body
    let fromNumber = req.body.From.substr(req.body.From.length - 10)

    console.log(fromNumber)

    dbRef.once('value')
        .then(function (snap) {
            console.log(snap.val())
            return snap.val();
        })
        .then(async function (userList) {
            // execute code when we get the return from the previous ".then()"
            // set the message for Twilio, using the argument
            let users = Object.keys(userList) 
            let inList = -1
            for(i = 0; i < users.length; i++){
                if(userList[users[i]]["phoneNumber"] == fromNumber){
                    inList = i
                    break
                    // Send all the shit and update state
                }
            }

            if(inList != -1){

                if ((userList[users[inList]]["state"] == "UBER") && ((msgBody == "UBER") || (msgBody=="🚗") )){
                    // State is UBER and message is UBER: call uber and set state to confirm
                    gc_id =(users[inList])
                    toCoords = userList[gc_id]["to"]
                    fromCoords = userList[gc_id]["from"]
                    let timeQuote = await getTimeQuote(fromCoords)
                    timeQuote /= 60
                    let costQuote = await getCostQuote(fromCoords, toCoords)
                    twiml.message(`The Uber will cost about ${costQuote} and it should be be here in about ${timeQuote} minutes. Still interested? Reply CONFIRM or 👍 to confirm.`)
                    updateState(gc_id, "CONFIRM")
                }

                else if ((userList[users[inList]]["state"] == "CONFIRM") && ((msgBody == "CONFIRM") || (msgBody == "👍"))){
                    // The customer wants to order the Uber!
                    let gc_id =(users[inList])
                    let clientToken = userList[gc_id]["uber"]["access_token"]["access_token"]
                    let toCoords = userList[gc_id]["to"]
                    let fromCoords = userList[gc_id]["from"]
                    fareID = getUberEstimate(fromCoords, toCoords, clientToken)
                    request = requestUber(fromCoords, toCoords, clientToken, fareID)
                    gc_id =(users[inList])
                    twiml.message("Your ride is on its way, Look for Kevin in a Blue Honda Accord! Phone Number 613-734-7892")
                    updateState(gc_id, "")
                    updateToFrom(gc_id, "", "")
                }

                else{
                    
                    let splitMsg = msgBody.split("=>")
                    let fromLocation = splitMsg[0].split(' ').join("%20");
                    let toLocation = splitMsg[1].split(' ').join("%20");
                    let fromCoords = await addressToCoords(fromLocation);
                    let toCoords = await addressToCoords(toLocation);
                    let reply = await coordsToDirections(fromCoords, toCoords);
                    // let userName = userList[users[inList]]["full_name"];
                    // let firstName = (userName === undefined) ? "" : userName.split(' ')[0];
                    // if (firstName != ""){
                    //   firstName = userName.split(' ')[0];
                    // }

                    welcomeMessage = `\nHey there!\n🚶 Welcome to Walkify 🚶 \n\nYour trip today should take about ${Math.round(reply["duration"]/60)} minutes.`
                    twiml.message(welcomeMessage)
                    messages = directionsToSMS(reply["directions"]);

                    for (let j = 0; j < messages.length; j++) {
                        content = `Directions Part ${j+1} of ${messages.length}:\n${messages[j]}`
                        twiml.message(content)
                    } 

                    twiml.message("Don't feel like walking? Too far?\n\n🚗Catch an Uber Instead!🚗\n\nReply UBER or 🚗 and we'll get you a ride!")

                    // set state to UBER
                    let gc_id = (users[inList])
                    console.log("gc_id: ", gc_id)
                    updateState(gc_id, "UBER")
                    updateToFrom(gc_id, toCoords, fromCoords, toCoords)
                }

            }else{
                twiml.message("I haven't seen you before! Go register for the service at Walkify.com!")
            }

            // respond to Twilio
            res.writeHead(200, { 'Content-Type': 'text/xml' });
            res.end(twiml.toString());
    });
    
});

http.createServer(app).listen(1337, () => {
  console.log('Express server listening on port 1337');
});