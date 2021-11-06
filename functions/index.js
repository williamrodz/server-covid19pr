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
var fetch = require("node-fetch");
const util = require('util')

const NO_NEW_CASES_MESSAGE = "ZERO_MOLECULAR_CASES"
const PR_HEALTH_DEPT_COVID_URL = "https://covid19datos.salud.gov.pr/"
const NUMBERS = "0123456789"
const SCRAPE_TYPE_CASES = "SCRAPE_TYPE_CASES"
const SCRAPE_TYPE_VACCINATIONS = "SCRAPE_TYPE_VAX" 


const TEST_URL = "http://localhost:5001/covid19puertorico-1a743/us-central1/"
const PRODUCTION_URL = "https://us-central1-covid19puertorico-1a743.cloudfunctions.net"

// SCHEDULED FUNCTIONS

exports.actionsFor8AM = functions.pubsub.schedule('00 8 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{
  Promise.all(
    [
      fetch(`${PRODUCTION_URL}/scrapeTodaysData`,{method:'GET'}),
      fetch(`${PRODUCTION_URL}/scrapeVaccineData`,{method:'GET'})
  ])
  .then(data=>{
    console.log("Success scraping today's data at 8am "+Object.keys(data))
    return data
  })
  .catch(error=>{
    console.log("Error scraping today's data at 8am: "+error)
    return error
  })

});

exports.actionsfor9AM = functions.pubsub.schedule('00 9 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{
  Promise.all(
    [
      fetch(`${PRODUCTION_URL}/scrapeTodaysData`,{method:'GET'}),
      fetch(`${PRODUCTION_URL}/scrapeVaccineData`,{method:'GET'}),
      fetch(`${PRODUCTION_URL}/tweetDailyInfo`,{method:'GET'}),
      fetch(`${PRODUCTION_URL}/tweetVaccineMessage`,{method:'GET'})
    ])
  .then(data=>{
    console.log("Success scraping today's numbers: "+Object.keys(data))
    return data
  })
  .catch(error=>{
    console.log("Error scraping todays data at 9am: "+error)
    return error
  })

});

exports.actionsForNoon = functions.pubsub.schedule('30 12 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{
    Promise.all(
      [
        fetch(`${PRODUCTION_URL}/scrapeTodaysData`,{method:'GET'}),
        fetch(`${PRODUCTION_URL}/scrapeVaccineData`,{method:'GET'}),
        fetch(`${PRODUCTION_URL}/tweetDailyInfo`,{method:'GET'}),
        fetch(`${PRODUCTION_URL}/tweetVaccineMessage`,{method:'GET'})      
      ])
  .then(data=>{
    console.log("Success scraping today's numbers: "+Object.keys(data))
    return data
  })
  .catch(error=>{
    console.log("Error scraping today's number: "+error)
    return error
  })

});

exports.actionsFor5PM = functions.pubsub.schedule('00 17 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{
    Promise.all(
      [
        fetch(`${PRODUCTION_URL}/scrapeTodaysData`,{method:'GET'}),
        fetch(`${PRODUCTION_URL}/scrapeVaccineData`,{method:'GET'}),
        fetch(`${PRODUCTION_URL}/tweetDailyInfo`,{method:'GET'}),
        fetch(`${PRODUCTION_URL}/tweetVaccineMessage`,{method:'GET'})      
      ])
  .then(data=>{
    console.log("Success scraping today's numbers: "+Object.keys(data))
    return data
  })
  .catch(error=>{
    console.log("Error scraping today's number: "+error)
    return error
  })

});

exports.actionsFor9PM = functions.pubsub.schedule('00 21 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{
    Promise.all(
      [
        fetch(`${PRODUCTION_URL}/scrapeTodaysData`,{method:'GET'}),
        fetch(`${PRODUCTION_URL}/scrapeVaccineData`,{method:'GET'}),
        fetch(`${PRODUCTION_URL}/tweetDailyInfo`,{method:'GET'}),
        fetch(`${PRODUCTION_URL}/tweetVaccineMessage`,{method:'GET'})      
      ])
  .then(data=>{
    console.log("Success scraping today's numbers: "+Object.keys(data))
    return data
  })
  .catch(error=>{
    console.log("Error scraping today's number: "+error)
    return error
  })

});


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

const getNumber = (numberString) =>{
  var output = ""
  for(var i=0; i <numberString.length; i++){
    let char = numberString[i];
    if (char !== ","){
      output +=char;
    }
  }
  return parseInt(output);
}

const formatInteger = (number)=>{
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const getCurrentESTTime = () =>{
  let time = new Date().toLocaleString('en-US',{timeZone:'America/La_Paz'})
  return time
}


exports.serverTimeCheck = functions.https.onRequest((request, response) => {
 return response.send(getCurrentESTTime());
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

  var scrapedData = await page.evaluate(() => {
    let molecularPositive = document.querySelector('#resumenTotalCasosConf');
    let antigenPositive = document.querySelector('#resumenTotalCasosProb');
    let deaths = document.querySelector('#resumenTotalMuertes');
    let saludTimeSignature = document.querySelector(".g-font-size-16.g-color-primary");

    var outputHTML  = {};
    try {
      outputHTML.molecularPositive = ( molecularPositive.innerText);
      outputHTML.antigenPositive = (antigenPositive.innerText);
      outputHTML.deaths = (deaths.innerText);
      outputHTML.saludTimeSignature = saludTimeSignature.innerText.trim();
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
    console.log(`Value is ${attribute}: ${value}`)
    if (value.indexOf("/") === -1){
      scrapedData[attribute] = getNumber(value);
      console.log("converting to number...")
    }
  } 

  return (scrapedData);  
}


// Primary method for scraping daily method.
exports.scrapeTodaysData = functions
.runWith({
  timeoutSeconds: 120,
  memory: "2GB"
})
.
https.onRequest(async (request, response) => {

  if (await isTodaysDataFresh()){
    return response.send({"status":"neutral","message":"data is fresh from scrape. no scrape needed"})
  }


  return sendScraper()
  .then(async(data)=>{

    var dataForToday = data
    console.log("Data for today is",Object.keys(data));
    timestamp = getTimeStamp()
    // Removing timestamp so log to data doesn't add repeated data
    // dataForToday["timestamp"] = timestamp
    

    dataForToday.totalPositive = (dataForToday.molecularPositive)+(dataForToday.antigenPositive);
    let dateIsFresh = await shouldTakeDataForDateAndType(dataForToday["saludTimeSignature"],SCRAPE_TYPE_CASES)
    if (dateIsFresh || request.query.force){
      let ref = admin.firestore().doc("data/todaysData")
      ref.set(dataForToday)
      .then(()=>{
        console.log(`Success scraping today's case count`)
        console.log(`Now attempting log to history of cases...`)
        let casesHistoryRef = admin.firestore().doc('data/historicalData');
        return casesHistoryRef.update(
          'all', admin.firestore.FieldValue.arrayUnion(dataForToday)
        )
      })
      .then(()=>{
        console.log(`Success logging today's case count to history!`)
        return response.send({"status":"success","message":"Today's data scraped and logged to history","newData":dataForToday})

      })
      .catch(e=>{
        console.log(`Error in the scraping order of events:${e}`)
      })

    } else{
      return response.send({"status":"failure","message":"Scraped data is stale"})
    }

    return response.send({"status":"failure","message":"Unknown error"})

  })
  .catch(error=>{
    const errorMessage = "Error scraping/writing\n"+error + "Finish error"
    console.log(errorMessage)
    return response.send(errorMessage)
  })
});


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


const getDateOfLastScrapeForDataType = async (scrapeType) =>{

  let documentIndex; 
  if (scrapeType === SCRAPE_TYPE_CASES){
    documentIndex = "data/historicalData"
  } else if (scrapeType === SCRAPE_TYPE_VACCINATIONS){
    documentIndex = "data/vaccineHistory"
  } else {
    throw new Error(`Invalid scrape type: ${scrapeType}`)
  }


  let ref = admin.firestore().doc(documentIndex)

  let allHistoricalDataSnapshot = await ref.get()

  let allHistoricalData = allHistoricalDataSnapshot.exists ? allHistoricalDataSnapshot.data().all : {'status':'DATA_NOT_AVAILABLE'}
  
  let lastScraped =  allHistoricalData[allHistoricalData.length - 1]
  let lastScrapedDate = lastScraped[scrapeType === SCRAPE_TYPE_CASES ? "saludTimeSignature" : "timeSignature"]

  return lastScrapedDate

}

const getDateObjectFromTimeSingature = (dateString) =>{
  // console.log(`Processing datestring ${dateString}`)
  let MMSDDSYYYY = dateString.split(" ")[2]
  let listOfMMSDDSYYYY = MMSDDSYYYY.split("/")

  let convertedDateObj = new Date(listOfMMSDDSYYYY[2],listOfMMSDDSYYYY[0] - 1,listOfMMSDDSYYYY[1])
  // console.log(`Obtained date: ${convertedDateObj}`)
  return convertedDateObj

}

const shouldTakeDataForDateAndType = async (scrapeDateString,scrapeType) =>{

  let lastScrapedDateString = await getDateOfLastScrapeForDataType(scrapeType)

  let newScrapeDate = getDateObjectFromTimeSingature(scrapeDateString)
  let latestScrapedDate = getDateObjectFromTimeSingature(lastScrapedDateString)

  return latestScrapedDate < newScrapeDate
}

const isSaludSignatureFresh = (dateString) =>{
  let currentESTTime = getCurrentESTTime()

  let MMSDDSYYYY = dateString.split(" ")[2]
  let listOfMMSDDSYYYY = MMSDDSYYYY.split("/")


  const saludDayOfMonth = parseInt(listOfMMSDDSYYYY[1])
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

let DO_NOT_TWEET = "DO_NOT_TWEET"

exports.obtainTodaysMessage = functions.https.onRequest( async (request, response) => {
  let todaysMessage = await getTodaysMessage()
  return response.send({"status":"OK","message":todaysMessage})
});

exports.getProgressBar = functions.https.onRequest( async (request, response) => {
  return response.send({"status":"OK","message":getProgressBar(request.query.progress)})
});

function getProgressBar(progress){
  let filled_blocks = parseInt( progress / 10);
  var empty_blocks = 10 - filled_blocks;
  var bar = `${"█".repeat(filled_blocks)}`;
  for (var i = 0; i < empty_blocks; i++){
    if (filled_blocks + i === 7){
      bar = `${bar}|`;
    }
    bar = `${bar}░`;
  }
  return bar
}

exports.isVaccineDataFresh = functions.https.onRequest( async (request, response) => {
  return response.send(await(isVaccineDataFresh()));
});


const isVaccineDataFresh = async() =>{
  const historicalDataRef = admin.firestore().doc('data/vaccineHistory');

  let freshness =
  historicalDataRef.get()
  .then(snapshot=>{
    if (snapshot.exists){
      const historicalData = snapshot.data().all
      const lengthOfData = historicalData.length
      const timeSignature = historicalData[lengthOfData-1].timeSignature
      return isSaludSignatureFresh(timeSignature);
    }
    return false; 
  })
  await freshness;
  return freshness;
}

const obtainVaccineMessage = async() => {
  const historicalDataRef = admin.firestore().doc('data/vaccineHistory');

  let filledMessage =
  historicalDataRef.get()
  .then(snapshot=>{
    if (snapshot.exists){
      const historicalData = snapshot.data().all
      const lengthOfData = historicalData.length
      // return historicalData[lengthOfData - 2].peopleWithTwoDoses
      return {
        timeSignature:historicalData[lengthOfData-1].timeSignature,
        peopleWithAtLeastOneDose: historicalData[lengthOfData-1].peopleWithAtLeastOneDose,
        peopleWithTwoDoses:historicalData[lengthOfData - 1].peopleWithTwoDoses,
        newPeopleWithADose:historicalData[lengthOfData-1].peopleWithAtLeastOneDose - historicalData[lengthOfData-2].peopleWithAtLeastOneDose,
        newPeopleWithTwoDoses:historicalData[lengthOfData - 1].peopleWithTwoDoses - historicalData[lengthOfData - 2].peopleWithTwoDoses
        }
    } else {
      return "SNAPSHOT_DOES_NOT_EXIST"
    }
  })
  .then(recentData =>{

    // do not tweet if no delta in vaccines, still not sure about vaccine data update frequency
    if (recentData.newDosesToday === 0 && recentData.newPeopleWithADose === 0 && recentData.newPeopleWithTwoDoses === 0){
      return DO_NOT_TWEET;  
    }
    let POPULATION_OF_PR = 2799926
    let percentageFullyVaccinated = ((recentData.peopleWithTwoDoses / POPULATION_OF_PR) * 100).toFixed(1)
    let newlyFullyVaccinatedPercentage = ((recentData.newPeopleWithTwoDoses / POPULATION_OF_PR) * 100).toFixed(1)
    let percentageOneDose = ((recentData.peopleWithAtLeastOneDose / POPULATION_OF_PR) * 100).toFixed(1) ;
    let newlyWithOneDosePercentage = ((recentData.newPeopleWithADose / POPULATION_OF_PR) * 100).toFixed(1)

  
    var message= `http://COVIDTrackerPR.com\n${recentData.timeSignature}\n\n`
    message += `Población con 1 de 2 dosis: ${formatInteger(percentageOneDose)}% (+${formatInteger(newlyWithOneDosePercentage)}%)\n`
    message += `Población con serie de dosis completada: ${formatInteger(percentageFullyVaccinated)}% (+${formatInteger(newlyFullyVaccinatedPercentage)}%)\n`
    message += `${getProgressBar(percentageFullyVaccinated)} ${percentageFullyVaccinated}%`
    message += "\n\n#COVIDー19 #PuertoRico #vacunas #vaccines"
    return message;

  })
  .catch(error=>error);



  return filledMessage;

}

exports.obtainVaccineMessage = functions.https.onRequest( async (request, response) => {
  let vaccineTweet = await obtainVaccineMessage();
  if (vaccineTweet === DO_NOT_TWEET){
    return response.send({"status":DO_NOT_TWEET,"message":"zero change in vaccine data"})
  }else {
    return response.send({"status":"OK","message":vaccineTweet})
  }
});

exports.tweetVaccineMessage = functions.https.onRequest( async (request, response) => {
  let vaccineTweet = await obtainVaccineMessage();
  
  let vaccineDataFresh = await isVaccineDataFresh();
  
  if (vaccineTweet === DO_NOT_TWEET){
    return response.send({"status":DO_NOT_TWEET,"message":"zero change in vaccine data, will not tweet"})
  }
  else if (!request.query.force && !vaccineDataFresh){
    return response.send({"status":DO_NOT_TWEET,"message":"Vaccine data is stale"})
  }  
  else {
    return response.send(await postTweet(vaccineTweet))
  }
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

    let historical = data[1]
    var message = `COVIDTrackerPR.com\n${saludTimeSignature}\n\n`
    message += `Total de pruebas positivas: ${formatInteger(today.totalPositive)} (+${formatInteger(historical.newPositivesToday)} hoy)\n`
    message += `moleculares: ${formatInteger(today.molecularPositive)} (+${formatInteger(historical.newMolecularPositiveToday)} hoy)\n`
    message += `antígeno: ${formatInteger(today.antigenPositive)} (+${formatInteger(historical.newAntigenPositive)} hoy)\n`
    message += `Muertes: ${formatInteger(today.deaths)} (+${formatInteger(historical.newDeathsToday)} hoy)\n\n`

    if (messageType === "twitter"){
      message += "#COVIDー19 #PuertoRico #coronavirus\n"
    }
    return message

    })
  .catch(error=>error)
}

const scrapeVaccineData = async () =>{

  const browser = await puppeteer.launch({
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage()
  console.log("Opening page..")
  await page.goto(PR_HEALTH_DEPT_COVID_URL,{ waitUntil: "networkidle2" })
  console.log("Clicking on selector..")
  await page.click('#dashboard_covid_nav > li:nth-child(2) > a');
  console.log("Looking for data..")

  var vaccineDataToday = await page.evaluate(()=>{
    let peopleWithAtLeastOneDose = (document.querySelector('#vacunasTotalDosis1').innerText);
    let peopleWithTwoDoses = (document.querySelector('#vacunasTotalDosis2').innerText);
    let timeSignature = (document.querySelector('#dashboard_covid--vacunacion > div.u-heading-v2-3--bottom.g-brd-primary.ml-3.g-my-10 > div.g-font-size-16.g-color-primary').innerText);


    return {peopleWithAtLeastOneDose:peopleWithAtLeastOneDose,peopleWithTwoDoses:peopleWithTwoDoses,timeSignature:timeSignature.trim()}
  });

  console.log("Got data!..")
  vaccineDataToday.peopleWithAtLeastOneDose = getNumber(vaccineDataToday.peopleWithAtLeastOneDose)
  vaccineDataToday.peopleWithTwoDoses = getNumber(vaccineDataToday.peopleWithTwoDoses)

  return (vaccineDataToday);  
}

exports.scrapeVaccineData = functions
.runWith({
  timeoutSeconds: 120,
  memory: "2GB"
})
.https.onRequest(async(request, response) => {

  // Check if scrape was already performed
  const dataSnapshot = await admin.firestore().doc('data/vaccinesToday').get();
  if (dataSnapshot.exists){
    if (isSaludSignatureFresh(dataSnapshot.data().timeSignature)){
      // data is fresh for today, no scrape needed
      return response.send({"status":"OK","message":"Scrape shows data is from today"})
    }
  }

  // Otherwise, begin scrape process 
  let vaccineDataForToday = await scrapeVaccineData();
  console.log("Now checking data..")
  // Update today's vaccination info
  if (await shouldTakeDataForDateAndType(vaccineDataForToday.timeSignature,SCRAPE_TYPE_CASES) || (request.query.force)){
    console.log("Vaccine data is new!")

    // Add to vaccinesToday index
    let ref = admin.firestore().doc("data/vaccinesToday")
    await ref.set(vaccineDataForToday)

    // add to historical log
    let vaccineHistoryLogRef = admin.firestore().doc('data/vaccineHistory');
    vaccineHistoryLogRef.update(
      'all', admin.firestore.FieldValue.arrayUnion(vaccineDataForToday)
    )
    .then(data => {
      return response.send({"status":"OK",message:"Updated vaccination history succesfully",data:vaccineDataForToday})
    })
    .catch(error=>{
      const errorMessage = "Error updating vaccine data\n"+error
      response.send(errorMessage)
  })
  } else {
    response.send({"status":"ERROR",message:"vaccine data is not fresh"})
  }

  
});





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

const logTweetDone = async () =>{
  let ref = admin.firestore().doc("data/tweet")
  const todaysDayOfMonth = (new Date(getCurrentESTTime())).getDate()
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

  if (!request.query.force && dataFresh === false){
    return response.send({"status":"stale","message":"Did not tweet. Data is not fresh"})
  }

  let tweetMessage = await getTodaysMessage("twitter")

  if (tweetMessage === NO_NEW_CASES_MESSAGE){
    return response.send({"status":"INVESTIGATE","message":"no new cases"});
  }

  // check if tweet was done
  let tweetDateRef = admin.firestore().doc(`data/tweet`)
  let tweetDataSnapshot = await tweetDateRef.get();  
  let lastTweetDayOfMonth = tweetDataSnapshot.data().dayOfTweet;

  const todaysDayOfMonth = (new Date(getCurrentESTTime())).getDate()

  if (lastTweetDayOfMonth !== todaysDayOfMonth){
    return postTweet(tweetMessage)
    .then(data=>response.send({"status":"OK","message":"Tweet posted"}))
    .catch(error=>response.send(error))
}else{
    return response.send({"status":"OK","message":`already sent todaysDayOfMonth:${todaysDayOfMonth},lastTweetDayOfMonth:${lastTweetDayOfMonth} `})
  }

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
