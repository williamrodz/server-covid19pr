const functions = require('firebase-functions');
var admin = require("firebase-admin");
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


const PR_HEALTH_DEPT_COVID_URL = "http://www.salud.gov.pr/Pages/coronavirus.aspx"
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


// Labels for columns as they appear on health dept site table
DATA_LABELS = ["molecularPositive","serologicalPositive","deaths"]

attachLabels = (data,labels) =>{
  output = {}
  for (var i = 0; i < labels.length; i++) {
    output[labels[i]] = data[i]
  }
  return output
}

getTimeStamp = ()=>{
  return new Date().toLocaleString('en-US',{timeZone:'America/La_Paz'});
}

// Primary method for scraping daily method.
exports.scrapeTodaysData = functions.https.onRequest(async (request, response) => {
  let dataFresh = await isTodaysDataFresh()
  if (dataFresh){
    return response.send({"message":"Data is fresh,no scrape needed"})
  }

  var x = Xray()

  scrapingSaludTimeSignature = new Promise((resolve,reject)=>{
    x(PR_HEALTH_DEPT_COVID_URL, '.ms-rteFontSize-2')((error,items)=>{
      if (error){
        reject(error)
      } else{
        resolve(items)
      }
    })
  })

  scrapingSaludTimeSignature
  .then(saludTimeSignature=>{
    scrapingData = new Promise((resolve,reject)=>{
      x(PR_HEALTH_DEPT_COVID_URL, ['.ms-rteElement-H2B'])((error,items)=>{
      if (error){
        reject(error)
      } else{
        // remove everything after comma 
        let commaIndex = saludTimeSignature.indexOf(",")
        resolve({items:items,saludTimeSignature:saludTimeSignature.substring(0,commaIndex)})
      }
    })
  })
  return scrapingData
})
  .then(data=>{
    items = data.items
    console.log("items are",items)
    saludTimeSignature = data.saludTimeSignature
    console.log("saludTimeSignature is",saludTimeSignature)
    integers = []
    for (var i = 0; i < items.length; i++) {
      string = items[i]
      console.log(`Scraped item is ${string}`)
      if (string.indexOf("COVID") === -1){// if firstChar starts with a number
        integers.push(parseInt(cleanString(string)))
      }
    }
    labeledData = attachLabels(integers,DATA_LABELS)
    timestamp = getTimeStamp()
    labeledData["saludTimeSignature"] = saludTimeSignature
    labeledData["timestamp"] = timestamp
    labeledData.totalPositive = labeledData.molecularPositive+labeledData.serologicalPositive
    if (isSaludSignatureFresh(saludTimeSignature)){
      let ref = admin.firestore().doc("data/todaysData")
      return ref.set(labeledData)
    } else{
      throw new Error("Did not scrape: Health Department data is stale.")
    }

  })
  .then(data=>response.send(data))
  .catch(error=>{
    const errorMessage = "Error scraping/writing\n"+error + "Finish error"
    console.log(errorMessage)
    return response.send(errorMessage)
  })
});

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

exports.thirdScheduledHistoryAddToday = functions.pubsub.schedule('12 40 * * *')
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

const isSaludSignatureFresh = (saludTimeSignature) =>{
  let currentESTTime = getCurrentESTTime()

  let trimmedSaludSignature = saludTimeSignature.trim()

  // get date of trimmedSaludSignature
  const locationOfAl = trimmedSaludSignature.indexOf("al ")
  const dateNumberStart = locationOfAl + 3
  const dateNumberEnd = trimmedSaludSignature[dateNumberStart+1] === " " ? dateNumberStart+1 : dateNumberStart+2

  const saludDayOfMonth = parseInt(trimmedSaludSignature.substring(dateNumberStart,dateNumberEnd))
  const todaysDayOfMonth = (new Date(currentESTTime)).getDate()
  console.log("Today's day of month is ",saludDayOfMonth)
  console.log("Data's day of month for today is",saludDayOfMonth)

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
    let leadingText = "(Datos al "
    let leadingTextIndex = saludTimeSignature.indexOf(leadingText)
    let justSaludDate = saludTimeSignature.substring(leadingTextIndex+leadingText.length,saludTimeSignature.length - 1)

    const dataIsTodayFresh = data[2]


    let historical = data[1]
    var message = `COVIDTrackerPR.com\n${justSaludDate}\n\n`
    message += `Total de casos positivos: ${formatInteger(today.totalPositive)} (+${formatInteger(historical.newPositivesToday)} hoy)\n`
    message += `moleculares: ${formatInteger(today.molecularPositive)} (+${formatInteger(historical.newMolecularPositiveToday)} hoy)\n`
    message += `serológicas: ${formatInteger(today.serologicalPositive)} (+${formatInteger(historical.newSerologicalPositiveToday)} hoy)\n`

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


exports.addPSID = functions.https.onRequest(async(request, response) => {
  let documentRef = admin.firestore().doc('users/PSIDs');
  let newPSID = request.query.PSID
  return documentRef.update(
    'all', admin.firestore.FieldValue.arrayUnion(newPSID)
  ).then(data => {
        return response.send({"status":"succes","notes":"Added new PSID succesfully"})
      })
});

exports.removePSID = functions.https.onRequest(async(request, response) => {
  let documentRef = admin.firestore().doc('users/PSIDs');
  let existingPSID = request.query.PSID
  return documentRef.update(
    'all', admin.firestore.FieldValue.arrayRemove(existingPSID)
  ).then(data => {
        return response.send({"status":"success","notes":"Removed PSID successfully"})
      })
});

exports.sendFBMessageToPSID = functions.https.onRequest(async(request, response) => {
  let reply = await sendFB(request.query.PSID,request.query.message)
  return response.send(reply)
});

exports.scheduledFBQA = functions.pubsub.schedule('30 10 * * *')
  .timeZone('America/La_Paz')
  .onRun( async (context)=>{
    let message = await getTodaysMessage()
    let PSIDs = keys.facebook.test_psids
    for (var i = 0; i < PSIDs.length; i++) {
      let destination = PSIDs[i]
      sendFB(message,destination)
    }
    return response.send("Executed all FB messages")

  });


const postTweet = async (message)=>{
  var Twitter = require('twitter');
  var twitterClient = new Twitter({
    consumer_key: keys.twitter.consumer_key,
    consumer_secret: keys.twitter.consumer_secret,
    access_token_key: keys.twitter.access_token_key,
    access_token_secret: keys.twitter.access_token_secret
  });


  return twitterClient.post('statuses/update', {status: message})
    .then(function (tweet) {
      console.log(tweet);
      return tweet
    })
    .catch(function (error) {
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

  return postTweet(tweetMessage)
  .then(data=>response.send(data))
  .catch(error=>response.send(error))
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

exports.thirdScheduledTweet = functions.pubsub.schedule('40 12 * * *')
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

// exports.cleanHistoricalData = functions.https.onRequest((request, response) => {
//   let documentRef = admin.firestore().doc('data/historicalData');
//   documentRef.get()
//   .then(snapshot=>{
//
//     if (snapshot.exists){
//       var data = snapshot.data() // list of data per day
//       let originalAll = data.all
//       console.log("----OG DATA")
//       originalAll.forEach((item, i) => {
//         console.log(item)
//       });
//
//       console.log("----OG DATA END --")
//
//     console.log("data is",originalAll.length, "long")
//     var newAll = []
//
//     //clean each data entry
//     for (var i = 0; i < originalAll.length; i++) {
//       let originalEntry = originalAll[i]
//       var newEntry = {...originalEntry}
//
//       var totalPositive = 0
//
//       if ('molecularTests' in originalEntry && 'serologicalTests' in originalEntry){
//
//         let molecularPositive = originalEntry.molecularTests
//         let serologicalPositive = originalEntry.serologicalTests
//
//         totalPositive += molecularPositive
//         totalPositive += serologicalPositive
//
//
//         // Change
//         delete newEntry.confirmedCases
//         delete newEntry.molecularTests
//         delete newEntry.serologicalTests
//
//         newEntry = {...newEntry,totalPositive:totalPositive,
//                         molecularPositive:molecularPositive,
//                         serologicalPositive:serologicalPositive}
//       }
//       else if ('probableCases' in originalEntry){
//         let molecularPositive = originalEntry.confirmedCases
//         let serologicalPositive = originalEntry.probableCases
//
//         totalPositive += molecularPositive
//         totalPositive += serologicalPositive
//
//
//         // Change
//         delete newEntry.confirmedCases
//         delete newEntry.probableCases
//         newEntry = {...newEntry,totalPositive:totalPositive,
//                         molecularPositive:molecularPositive,
//                         serologicalPositive:serologicalPositive}
//
//
//       }
//       else {
//         totalPositive = originalEntry.confirmedCases
//         // Change
//         delete newEntry.confirmedCases
//         newEntry = {...newEntry,totalPositive:totalPositive}
//       }
//
//       newAll.push(newEntry)
//     }
//
//
//
//
//     console.log("newAll is",newAll.length, "long")
//
//
//     return documentRef.set({all:newAll})
//     }
//     else{
//       return "Data not found"
//     }
//   })
//   .then(result=>response.send(result))
//   .catch(error=>response.send(error))
// });

//
//
// exports.loadSampleHistoricalData = functions.https.onRequest((request, response) => {
//   beginnerData = [
//     {month:4,
//     day:6,
//     year:2020,
//     confirmedCases:513},
//     {month:4,
//     day:7,
//     year:2020,
//     confirmedCases:573},
//     {month:4,
//     day:8,
//     year:2020,
//     confirmedCases:620},
//     {month:4,
//     day:9,
//     year:2020,
//     confirmedCases:683},
//     {month:4,
//     day:10,
//     year:2020,
//     confirmedCases:725},
//     {month:4,
//     day:11,
//     year:2020,
//     confirmedCases:788},
//     {month:4,
//     day:12,
//     year:2020,
//     confirmedCases:897},
//
//   ]
//
//   let ref = admin.firestore().doc("data/historicalData")
//   ref.set({last7Days:beginnerData})
//   .then(data=>response.send(beginnerData))
//   .catch(error=>response.send(error))
//
// });
