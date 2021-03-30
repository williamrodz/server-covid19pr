const functions = require('firebase-functions');
var admin = require("firebase-admin");
const puppeteer = require('puppeteer');

var keys = require("./privateKey.json")

// Used to scrape webpages that have not been certified
const https = require("https");
const agent = new https.Agent({
  rejectUnauthorized: false
})

// Initialize firebase app
admin.initializeApp({
  credential: admin.credential.cert(keys.firebase),
  databaseURL: "https://covid19puertorico-1a743.firebaseio.com"
});

// Used for web scraping
var Xray = require('x-ray')
var fetch = require("node-fetch");
const util = require('util')


const PR_HEALTH_DEPT_COVID_URL = "https://covid19datos.salud.gov.pr/"
const NUMBERS = "0123456789"

// Helper Functions
cleanString = (text) =>{
  var output = ""
  for (var i = 0; i < text.length; i++) {
    if (NUMBERS.indexOf(text[i]) !== -1){
      output += text[i]
    }
  }
  return output
}

const formatInteger = (number)=>{
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const getCurrentESTTime = () =>{
  let time = new Date().toLocaleString('en-US',{timeZone:'America/La_Paz'})
  return time
}


exports.serverTimeCheck = functions.https.onRequest((request, response) => {
 response.send(getCurrentESTTime());
});


getTimeStamp = ()=>{
  return new Date().toLocaleString('en-US',{timeZone:'America/La_Paz'});
}

const sendScraper = async () => {
  const url = PR_HEALTH_DEPT_COVID_URL;
  const width =  1024;
  const height = 768;

  if (!url) {
    console.log("No URL provided")
    return response.send(`Invalid url: ${url}`);
  }

  const browser = await puppeteer.launch({
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "networkidle2" });

  await page.setViewport({ width, height });

  // get hotel details
  var scrapedData = await page.evaluate(() => {
    // get the hotel elements
    let molecularPositive = document.querySelector('#totalConf');
    let antigenPositive = document.querySelector('#totalProb');
    let serologicalPositive = document.querySelector('#totalSosp');
    let deaths = document.querySelector('#totalMuertes');
    let saludTimeSignature = document.querySelector(".g-font-size-20.g-color-primary");

    var outputHTML  = {};
    try {
      outputHTML.molecularPositive = ( molecularPositive.innerText);
      outputHTML.antigenPositive = (antigenPositive.innerText);
      outputHTML.serologicalPositive =  (serologicalPositive.innerText);
      outputHTML.deaths = (deaths.innerText);
      outputHTML.saludTimeSignature = saludTimeSignature.innerText;
    }
    catch (exception){
      console.log("exception");
    }
    console.log("outputHTML",outputHTML);
    return outputHTML;
  });

  await browser.close();
  // return response.type('application/json').send(JSON.stringify(scrapedData));
  let attributes = Object.keys(scrapedData);

  for(var i=0; i < attributes.length;i++){
    let attribute = attributes[i];
    let value = scrapedData[attribute];
    console.log(`Value is ${attribute}:${value}`)
    if (value.indexOf("de") === -1){
      console.log("NUMBER!")
      scrapedData[attribute] = getNumber(value);
    }
  } 

  return (scrapedData);  
}

// .runWith({
//   timeoutSeconds: 120,
//   memory: "2GB"
// })
exports.scrapeDataAlpha = functions
.runWith({
  timeoutSeconds: 120,
  memory: "2GB"
})
  .https.onRequest( async(request, response) => {

    let scrapedData = sendScraper(); 
    scrapedData.then(data=>response.send(data))
    .catch(error=>response.send({error:error}));
  });

function getNumber(numberString){
  var output = ""
  for(var i=0; i <numberString.length; i++){
    let char = numberString[i];
    if (char !== ","){
      output +=char;
    }
  }
  return parseInt(output);
}

// Primary method for scraping daily method.
exports.scrapeTodaysData = functions
.runWith({
  timeoutSeconds: 120,
  memory: "2GB"
})
.
https.onRequest(async (request, response) => {

  return sendScraper()
  .then(async(data)=>{

    var dataForToday = data
    console.log("Data for today is",Object.keys(data));
    timestamp = getTimeStamp()
    dataForToday["timestamp"] = timestamp


    dataForToday.totalPositive = (dataForToday.molecularPositive)+(dataForToday.serologicalPositive)+(dataForToday.antigenPositive);
    if (isSaludSignatureFresh(dataForToday["saludTimeSignature"])){
      let ref = admin.firestore().doc("data/todaysData")
      await ref.set(dataForToday)
      return response.send({"status":"success","newData":dataForToday})
    } else{
      throw new Error("Did not scrape: Health Department data is stale.")
    }
    // return response.send(dataForToday)
  })
  .catch(error=>{
    const errorMessage = "Error scraping/writing\n"+error + "Finish error"
    console.log(errorMessage)
    return response.send(errorMessage)
  })
});

TEST_URL = "http://localhost:5001/covid19puertorico-1a743/us-central1/"
PRODUCTION_URL = "https://us-central1-covid19puertorico-1a743.cloudfunctions.net"

exports.eightAMscheduleScrape = functions.pubsub.schedule('00 8 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{
  url = `${PRODUCTION_URL}/scrapeTodaysData`
  fetch(url,{method:'GET'})
  .then(data=>{
    console.log("Success scraping today's numbers: "+Object.keys(data))
    return data
  })
  .catch(error=>{
    console.log("Error scraping today's number: "+error)
    return error
  })

});

exports.nineAMScheduledScrape = functions.pubsub.schedule('00 9 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{
  url = `${PRODUCTION_URL}/scrapeTodaysData`
  fetch(url,{method:'GET'})
  .then(data=>{
    console.log("Success scraping today's numbers: "+Object.keys(data))
    return data
  })
  .catch(error=>{
    console.log("Error scraping today's number: "+error)
    return error
  })

});

exports.noonScheduledScrape = functions.pubsub.schedule('30 12 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{
  url = `${PRODUCTION_URL}/scrapeTodaysData`
  fetch(url,{method:'GET'})
  .then(data=>{
    console.log("Success scraping today's numbers: "+Object.keys(data))
    return data
  })
  .catch(error=>{
    console.log("Error scraping today's number: "+error)
    return error
  })

});


//
// exports.scrapeMunicipiosData = functions.https.onRequest((request, response) => {
//   console.log("Scraiping data for municipios")
//   var x = Xray()
//   datesURL = "https://github.com/Code4PuertoRico/covid19-pr-api/tree/master/data"
//
//   gettingDates = new Promise((resolve,reject)=>{
//     x(datesURL, 'ol',['li'])((error,items)=>{
//       if (error){
//         reject(error)
//       } else{
//         resolve(items)
//       }
//     })
//   })
//
//
//   gettingDates
//   .then(dates=>{
//     lastDate = dates[dates.length - 1]
//     console.log("Last date is "+lastDate)
//
//     splitUp = lastDate.split("-") // date is in form 04-11-2020
//     month = parseInt(splitUp[0]) // has to be in single digit form for URL, others don't
//     day = splitUp[1]
//     year = splitUp[2]
//
//     const url = `https://raw.githubusercontent.com/Code4PuertoRico/covid19-pr-api/master/data/PuertoRicoTaskForce/${month}-${day}-${year}/CSV/municipios.csv`
//     console.log(`GET ${url}`)
//     return fetch(url,{method:'GET'})
//   })
//   .then(data=>{
//     return data.buffer()
//   })
//   .then(buffer=>{
//     var text = buffer.toString()
//     // clean out quote chars
//     text = text.replace(/"/g, '')
//     var rows = text.split("\n")
//     console.log("ROWS",rows)
//     for (var i = 0; i < rows.length; i++) {
//       rows[i] = rows[i].split(",")
//     }
//     var municipiosData = {}
//     for (var j = 2; j < rows.length; j++) {
//       const row = rows[j]
//       console.log(`Row is ${row}`)
//       const MUNICIPIO_NAME_i = 0
//       const CONFIRMED_CASES_i = 1
//
//       var muncipioName = row[MUNICIPIO_NAME_i].slice(0,-1)
//       // correct municipio names
//       nameCorrections = {"Afasco":"Añasco","Bayamon":"Bayamón","Catano":"Cataño",
//       "Guanica":"Guánica","Loiza":"Loíza","Manati":"Manatí","Mayaguez":"Mayagüez",
//       "Rincon":"Rincón","Sabana Grande":"Sábana Grande","San German":"San Germán",
//       "San Sebastian":"San Sebastián"}
//       if (muncipioName in nameCorrections){
//         muncipioName = nameCorrections[muncipioName]
//       }
//
//
//       const confirmedCases = parseInt(row[CONFIRMED_CASES_i])
//       if (muncipioName.length > 0){
//         municipiosData[muncipioName] = {confirmedCases:confirmedCases}
//       }
//     }
//     return municipiosData
//   })
//   .then(municipiosData=>{
//     municipiosData["timestamp"] = getTimeStamp()
//
//     let ref = admin.firestore().doc("data/municipios")
//     return ref.set({all:municipiosData})
//
//   })
//   .then(data=>response.send(data))
//   .catch(error=>{
//     return response.send(error)
//   })
//
// });

//
// exports.scheduledMunicipioScrape = functions.pubsub.schedule('35 9 * * *')
//   .timeZone('America/La_Paz')
//   .onRun((context)=>{
//     TESTING_URL = "http://localhost:5001/covid19puertorico-1a743/us-central1/scrapeMunicipiosData"
//     PRODUCTION_URL = "https://us-central1-covid19puertorico-1a743.cloudfunctions.net/scrapeMunicipiosData"
//
//     url = PRODUCTION_URL
//     fetch(url,{method:'GET'})
//       .then(data=>{
//           console.log("Success adding today's data to history: "+Object.keys(data))
//           return data
//         })
//       .catch(error=>{
//         console.log("Error adding today's data to history: "+error)
//         return error
//       })
//
// });

exports.logTodaysDataToHistory = functions.https.onRequest((request, response) => {
  let ref = admin.firestore().doc("data/todaysData")
  ref.get()
  .then(snapshot=>{
    if (snapshot.exists){
      let data = snapshot.data()
      return data
    } else{
      return {noDataAvailable:true}
    }
  })
  .then(newDataEntry=>{
    let documentRef = admin.firestore().doc('data/historicalData');
    return documentRef.update(
      'all', admin.firestore.FieldValue.arrayUnion(newDataEntry)
    )
  })
    .then(data => {
      return response.send("Updated history succesfully")
    })
    .catch(error=>{
      const errorMessage = "Error updating historical data\n"+error
      response.send(errorMessage)
  })

});



exports.scheduledHistoryAddToday = functions.pubsub.schedule('10 8 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{
    var url = `${PRODUCTION_URL}/logTodaysDataToHistory`
    fetch(url,{method:'GET'})
      .then(data=>{
          console.log("Success adding today's data to history: "+Object.keys(data))
          return data
        })
      .catch(error=>{
        console.log("Error adding today's data to history: "+error)
        return error
      })

});


exports.secondScheduledHistoryAddToday = functions.pubsub.schedule('40 9 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{

    var url = `${PRODUCTION_URL}/logTodaysDataToHistory`
    fetch(url,{method:'GET'})
      .then(data=>{
          console.log("Success adding today's data to history: "+Object.keys(data))
          return data
        })
      .catch(error=>{
        console.log("Error adding today's data to history: "+error)
        return error
      })

});

exports.thirdScheduledHistoryAddToday = functions.pubsub.schedule('40 12 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{

    var url = `${PRODUCTION_URL}/logTodaysDataToHistory`
    fetch(url,{method:'GET'})
      .then(data=>{
          console.log("Success adding today's data to history: "+Object.keys(data))
          return data
        })
      .catch(error=>{
        console.log("Error adding today's data to history: "+error)
        return error
      })

});

const isSaludSignatureFresh = (dateString) =>{
  let currentESTTime = getCurrentESTTime()

  let trimmedSaludSignature = dateString.trim()

  // get date of trimmedSaludSignature
  const locationOfAl = trimmedSaludSignature.indexOf(", ")
  const dateNumberStart = locationOfAl + 2
  const dateNumberEnd = trimmedSaludSignature[dateNumberStart+1] === " " ? dateNumberStart+1 : dateNumberStart+2

  const saludDayOfMonth = parseInt(trimmedSaludSignature.substring(dateNumberStart,dateNumberEnd))
  const todaysDayOfMonth = (new Date(currentESTTime)).getDate()

  return saludDayOfMonth === todaysDayOfMonth
}


const isTodaysDataFresh = async () => {
  let ref = admin.firestore().doc("data/todaysData")
  let todaysData = await
  ref.get()
  .then(snapshot=>{
    if (snapshot.exists){
      let data = snapshot.data()
      return data
    } else{
      return {noDataAvailable:true}
    }
  })


  let dataIsTodayFresh = isSaludSignatureFresh(todaysData.saludTimeSignature)
  return dataIsTodayFresh

}


exports.checkDataFresh = functions.https.onRequest( async (request, response) => {
  let dataFresh = await isTodaysDataFresh()
  return response.send({"dataFresh":dataFresh})
});


exports.obtainTodaysMessage = functions.https.onRequest( async (request, response) => {
  let todaysMessage = await getTodaysMessage()
  return response.send({"message":todaysMessage})
});

const getTodaysMessage = async (messageType) =>{

  let ref = admin.firestore().doc("data/todaysData")
  let todaysData =
  ref.get()
  .then(snapshot=>{
    if (snapshot.exists){
      let data = snapshot.data()
      return data
    } else{
      return {noDataAvailable:true}
    }
  })

  const historicalDataRef = admin.firestore().doc('data/historicalData');

  let historicalDataFromFireBase =
  historicalDataRef.get()
  .then(snapshot=>{
    if (snapshot.exists){
      const historicalData = snapshot.data().all
      const lengthOfData = historicalData.length
      return {
        all:historicalData,
        newPositivesToday:historicalData[lengthOfData-1].totalPositive - historicalData[lengthOfData-2].totalPositive,
        newDeathsToday:historicalData[lengthOfData-1].deaths - historicalData[lengthOfData-2].deaths,
        newMolecularPositiveToday:historicalData[lengthOfData-1].molecularPositive - historicalData[lengthOfData-2].molecularPositive,
        newSerologicalPositiveToday:historicalData[lengthOfData-1].serologicalPositive - historicalData[lengthOfData-2].serologicalPositive,
        newAntigenPositive:historicalData[lengthOfData-1].antigenPositive - historicalData[lengthOfData-2].antigenPositive,

        }
    }
    else{
      return {dataAvailable:false}
    }
  })


  return Promise.all([todaysData,historicalDataFromFireBase,isTodaysDataFresh()])
  .then(data=>{
    let currentESTTime = getCurrentESTTime()
    console.log("currentESTTime",currentESTTime)

    let today = data[0]
    let saludTimeSignature = today.saludTimeSignature.trim()
    let leadingText = ","
    let leadingTextIndex = saludTimeSignature.indexOf(leadingText)
    let justSaludDate = saludTimeSignature.substring(leadingTextIndex+2,saludTimeSignature.length)

    const dataIsTodayFresh = data[2]


    let historical = data[1]
    var message = `COVIDTrackerPR.com\n${justSaludDate}\n\n`
    message += `Total de casos positivos: ${formatInteger(today.totalPositive)} (+${formatInteger(historical.newPositivesToday)} hoy)\n`
    message += `moleculares: ${formatInteger(today.molecularPositive)} (+${formatInteger(historical.newMolecularPositiveToday)} hoy)\n`
    message += `serológicas: ${formatInteger(today.serologicalPositive)} (+${formatInteger(historical.newSerologicalPositiveToday)} hoy)\n`
    message += `antígeno: ${formatInteger(today.antigenPositive)} (+${formatInteger(historical.newAntigenPositive)} hoy)\n`
    message += `Muertes: ${formatInteger(today.deaths)} (+${formatInteger(historical.newDeathsToday)} hoy)\n\n`

    if (messageType === "twitter"){
      message += "#COVIDー19 #PuertoRico #coronavirus\n"
    }
    // message += "- - - - - - \n"
    // message += "Data del Departamento de Salud"
    //message += `Data for today ${currentESTTime.substring(0,currentESTTime.indexOf(','))}`
    // ^ date in m/d/y
    // message += dataIsTodayFresh ? "Data is fresh :)" : "Data is NOT fresh :("


    return message

    })
  .catch(error=>error)
}





const accountSid = keys.twilio.twilio_account_sid; // Your Account SID from www.twilio.com/console
const authToken = keys.twilio.twilio_auth_token;   // Your Auth Token from www.twilio.com/console

const twilio = require('twilio');
const client = new twilio(accountSid, authToken);

const sendFB = async (message,PSID) =>{

  console.log("Sending FB message ...")
  console.log("access token is ",keys.facebook.access_token)

  const body = {
    access_token: keys.facebook.access_token,
    recipient: {
      id: PSID
    },
    message: {
      text: message,
      quick_replies:[
              {
                content_type:"text",
                title:"Sí",
                payload:"yes",
                // "image_url":"http://example.com/img/red.png"
              },{
                content_type:"text",
                title:"No",
                payload:"no",
                // "image_url":"http://example.com/img/green.png"
              }
            ]
    }
	};



  return fetch('https://graph.facebook.com/v7.0/me/messages', {
  		method: 'post',
  		body: JSON.stringify(body),
  		headers: {'Content-Type': 'application/json'}
});
}


const sendSMS = async (number,message) => {
  console.log(`Sending message to ${number}`)
  client.messages.create({
      body: message,
      to: number,  // Text this number
      from: "+12058096622" // From a valid Twilio number
  })
  .then((message) => {
    console.log(`Success sending message. SID:${message.sid}`)
    return message.sid
  })
  .catch(error=>{
    console.log(`Error sending message:${error}`)
    });
}


exports.sendAllSMS = functions.https.onRequest(async(request, response) => {
  let dataNotStale = await isTodaysDataFresh()

  let message = dataNotStale ?  await getTodaysMessage() : "El Departamento de Salud no ha publicado la data de Covid para hoy."
  console.log("MESSAGES IS\n",message)
  console.log("END MESSAGE")
  let NUMBERS = keys.twilio.test_numbers
  var sentMessageSIDs = []
  for (var i = 0; i < NUMBERS.length; i++) {
    let destination = NUMBERS[i]
    sentMessageSIDs.push(sendSMS(destination,message))
  }
  return Promise.all(sentMessageSIDs).then(sids=>response.send("Executed all SMS messages successfully"))
  .catch(error=>response.send("Error sending SMS messages\n"+error))


});

exports.scheduledSMSQA = functions.pubsub.schedule('30 10 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{

    url = `${PRODUCTION_URL}/sendAllSMS`
    fetch(url,{method:'GET'})
      .then(data=>{
          console.log("Success sending SMS message today:"+data)
          return data
        })
      .catch(error=>{
        console.log("Error sending today's SMS"+error)
        return error
      })

});


// exports.addPSID = functions.https.onRequest(async(request, response) => {
//   let documentRef = admin.firestore().doc('users/PSIDs');
//   let newPSID = request.query.PSID
//   return documentRef.update(
//     'all', admin.firestore.FieldValue.arrayUnion(newPSID)
//   ).then(data => {
//         return response.send({"status":"succes","notes":"Added new PSID succesfully"})
//       })
// });

// exports.removePSID = functions.https.onRequest(async(request, response) => {
//   let documentRef = admin.firestore().doc('users/PSIDs');
//   let existingPSID = request.query.PSID
//   return documentRef.update(
//     'all', admin.firestore.FieldValue.arrayRemove(existingPSID)
//   ).then(data => {
//         return response.send({"status":"success","notes":"Removed PSID successfully"})
//       })
// });

// exports.sendFBMessageToPSID = functions.https.onRequest(async(request, response) => {
//   let reply = await sendFB(request.query.PSID,request.query.message)
//   return response.send(reply)
// });

// exports.scheduledFBQA = functions.pubsub.schedule('30 10 * * *')
//   .timeZone('America/La_Paz')
//   .onRun( async (context)=>{
//     let message = await getTodaysMessage()
//     let PSIDs = keys.facebook.test_psids
//     for (var i = 0; i < PSIDs.length; i++) {
//       let destination = PSIDs[i]
//       sendFB(message,destination)
//     }
//     return response.send("Executed all FB messages")

//   });

const logTweetDone = async () =>{
  let ref = admin.firestore().doc("data/tweet")
  const todaysDayOfMonth = (new Date(currentESTTime)).getDate()
  await ref.set(todaysDayOfMonth)
}

const postTweet = async (message)=>{
  var Twitter = require('twitter');
  var twitterClient = new Twitter({
    consumer_key: keys.twitter.consumer_key,
    consumer_secret: keys.twitter.consumer_secret,
    access_token_key: keys.twitter.access_token_key,
    access_token_secret: keys.twitter.access_token_secret
  });


  return twitterClient.post('statuses/update', {status: message})
    .then( async (tweet) => {
      await logTweetDone();
      console.log(tweet);
      return tweet
    })
    .catch( (error) =>{
      console.log(error);
      return error
    })
}

exports.tweetDailyInfo = functions.https.onRequest(async(request, response) => {

  let dataFresh = await isTodaysDataFresh()

  if (dataFresh === false){
    return response.send({"status":"stale","message":"Did not tweet. Data is not fresh"})
  }

  let tweetMessage = await getTodaysMessage("twitter")

  // check if tweet was done
  let tweetDateRef = admin.firestore().doc(`data/tweet`)
  let tweetDataSnapshot = await tweetDateRef.get();  
  let lastTweetDayOfMonth = tweetDataSnapshot.data().dayOfTweet;

  const todaysDayOfMonth = (new Date(getCurrentESTTime())).getDate()

  if (lastTweetDayOfMonth !== todaysDayOfMonth){
    return postTweet(tweetMessage)
    .then(data=>response.send({todaysDayOfMonth:todaysDayOfMonth,lastTweetDayOfMonth:lastTweetDayOfMonth}))
    .catch(error=>response.send(error))
  } else{
    return response.send({"status":"OK","message":`already sent todaysDayOfMonth:${todaysDayOfMonth},lastTweetDayOfMonth:${lastTweetDayOfMonth} `})
  }

});






exports.scheduledTweet = functions.pubsub.schedule('30 9 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{

    url = `${PRODUCTION_URL}/tweetDailyInfo`
    fetch(url,{method:'GET'})
      .then(data=>{
          console.log("Success executing today's tweet\n"+data)
          return data
        })
      .catch(error=>{
        console.log("Error sending today's Tweet\n"+error)
        return error
      })

});

exports.secondScheduledTweet = functions.pubsub.schedule('30 10 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{

    url = `${PRODUCTION_URL}/tweetDailyInfo`
    fetch(url,{method:'GET'})
      .then(data=>{
          console.log("Success executing today's tweet\n"+data)
          return data
        })
      .catch(error=>{
        console.log("Error sending today's Tweet\n"+error)
        return error
      })

});

exports.thirdScheduledTweet = functions.pubsub.schedule('0 12 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{

    url = `${PRODUCTION_URL}/tweetDailyInfo`
    fetch(url,{method:'GET'})
      .then(data=>{
          console.log("Success executing today's tweet\n"+data)
          return data
        })
      .catch(error=>{
        console.log("Error sending today's Tweet\n"+error)
        return error
      })

});


// Public-facing API 

let API_CALL_LIMIT = 1000
exports.getTodaysData = functions.https.onRequest(async(request, response) => {

  let userAPIkey = request.query.key
  let userInfoRef = admin.firestore().doc(`users/${userAPIkey}`)

  let userInfoSnapshot = await userInfoRef.get();
  const increment =  admin.firestore.FieldValue.increment(1);

  
  var isAuthorized = false
  var statusMessage = "" 

  if (userInfoSnapshot.exists){
    console.log(`User ${userAPIkey} is making an API call`)
    let userInfoData =  userInfoSnapshot.data()
    // Check how many calls have been made
    if (userInfoData.numberOfGetTodaysDataCalls){
      if (userInfoData.numberOfGetTodaysDataCalls < API_CALL_LIMIT){
        isAuthorized = true
        numberOfGetTodaysDataCalls = userInfoData.numberOfGetTodaysDataCalls
      }
      else {
        statusMessage = "NUMBER_OF_CALLS_EXCEEDED"
      }
    }
    // User exists with no record of API calls
    else{
      isAuthorized = true
    }

  // User/key does not exist   
  } else{
    statusMessage = 'NOT_AUTHORIZED'
  }


  if (isAuthorized === false){
    return response.send({'status':'ERROR','message':statusMessage})
  }


  let dataFresh = await isTodaysDataFresh()
  let todaysDataRef = admin.firestore().doc("data/todaysData")
  let todaysDataSnapshot = await todaysDataRef.get()
  let todaysData = todaysDataSnapshot.data()

  userInfoRef.update({numberOfGetTodaysDataCalls:increment})

  return response.send({'status':'OK','data':todaysData})



});

exports.getHistoricalData = functions.https.onRequest(async(request, response) => {

  let userAPIkey = request.query.key
  let userInfoRef = admin.firestore().doc(`users/${userAPIkey}`)

  let userInfoSnapshot = await userInfoRef.get();
  const increment =  admin.firestore.FieldValue.increment(1);


  
  var isAuthorized = false
  var statusMessage = "" 

  if (userInfoSnapshot.exists){
    console.log(`User ${userAPIkey} is making an API call`)
    let userInfoData =  userInfoSnapshot.data()
    // Check how many calls have been made
    if (userInfoData.numberOfGetHistoricalDataCalls){
      if (userInfoData.numberOfGetHistoricalDataCalls < API_CALL_LIMIT){
        isAuthorized = true
        usernumberOfGetHistoricalDataCalls = userInfoData.numberOfGetHistoricalDataCalls
      }
      else {
        statusMessage = "NUMBER_OF_CALLS_EXCEEDED"
      }
    }
    // User exists with no record of API calls
    else{
      isAuthorized = true
    }

  // User/key does not exist   
  } else{
    statusMessage = 'NOT_AUTHORIZED'
  }


  if (isAuthorized === false){
    return response.send({'status':'ERROR','message':statusMessage})
  }


    let ref = admin.firestore().doc("data/historicalData")

    let allDataSnapshot = await ref.get()
  
    let allData = allDataSnapshot.exists ? allDataSnapshot.data().all : {'status':'DATA_NOT_AVAILABLE'}
  
    // Clean by args
  
    // Scenario 1: list of statistics, all valid
    // Senario 2: list of stats, some invalid
    // Scenario 3: one statistic, valid
    // Scenario 4: one stat, not valid
    // Scenario 5: nothing; all stats
  
    let VALID_STATISTICS = {'totalPositive':true,'molecularPositive':true,'serologicalPositive':true,'deaths':true,timestamp:true,saludTimeSignature:true}
    
    var desiredStatistics =  null
    if (request.query.desiredStatistic === undefined){
      // not supplied
      desiredStatistics = Object.keys(VALID_STATISTICS)
    }
    else {
      if (VALID_STATISTICS[request.query.desiredStatistic] !== true){
        return response.send({'status':'ERROR','message':'Invalid desired statistics entered'})
      } else{
        desiredStatistics = [request.query.desiredStatistic]
      }
    }
      
    // clean
    var output = []
    for (let index = 0; index < allData.length; index++) {
      const dataForDay = allData[index];
  
      const entry = {timestamp:dataForDay.timestamp,saludTimeSignature:dataForDay.saludTimeSignature}
      desiredStatistics.forEach(label => {
        if (dataForDay[label] !== null){
          entry[label] = dataForDay[label]
        }
      });
      output.push(entry)
    }
  
    let formattedOutput = {'status':'OK','data':output}
    userInfoRef.update({numberOfGetHistoricalDataCalls:increment})
    return response.send(formattedOutput)    

});
