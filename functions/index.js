const functions = require('firebase-functions');
var admin = require("firebase-admin");
var keys = require("./privateKey.json")
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const https = require("https");
const agent = new https.Agent({
  rejectUnauthorized: false
})

admin.initializeApp({
  credential: admin.credential.cert(keys.firebase),
  databaseURL: "https://covid19puertorico-1a743.firebaseio.com"
});


var Xray = require('x-ray')
var fetch = require("node-fetch");
const util = require('util')


const salud_web_site_url = "http://www.salud.gov.pr/Pages/coronavirus.aspx"
const NUMBERS = "0123456789"

exports.helloWorld = functions.https.onRequest((request, response) => {
 response.send("Hello from Firebase! ^_^");
});

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

exports.serverTimeCheck = functions.https.onRequest((request, response) => {
 response.send(new Date().toLocaleString('en-US',{timeZone:'America/La_Paz'}));
});



DATA_LABELS = ["confirmedCases","molecularTests","serologicalTests","deaths"]

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


exports.newScrape = functions.https.onRequest((request, response) => {
  var x = Xray()

  scrapingSaludTimeSignature = new Promise((resolve,reject)=>{
    x("https://www.covid19prdata.org/dashboard", ['h5'])((error,items)=>{
      if (error){
        reject(error)
      } else{
        resolve(items)
      }
    })
  })

  scrapingSaludTimeSignature.then(data=>response.send(data))
  .catch(error=>response.send("ERROR:"+error))
});




exports.scrapeTodaysData = functions.https.onRequest((request, response) => {
  var x = Xray()

  scrapingSaludTimeSignature = new Promise((resolve,reject)=>{
    x(salud_web_site_url, '.ms-rteElement-H3B')((error,items)=>{
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
      x(salud_web_site_url, ['.ms-rteElement-H2B'])((error,items)=>{
      if (error){
        reject(error)
      } else{
        resolve({items:items,saludTimeSignature:saludTimeSignature})
      }
    })
  })
  return scrapingData
})
  .then(data=>{
    items = data.items
    console.log("items are",items)
    saludTimeSignature = data.saludTimeSignature
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

    let ref = admin.firestore().doc("data/todaysData")
    return ref.set(labeledData)
  })
  .then(data=>response.send(data))
  .catch(error=>{
    const errorMessage = "Error scraping/writing\n"+error + "Finish error"
    console.log(errorMessage)
    return response.send(errorMessage)
  })
});

TESTING_URL = "http://localhost:5001/covid19puertorico-1a743/us-central1/scrapeTodaysData"
PRODUCTION_URL = " https://us-central1-covid19puertorico-1a743.cloudfunctions.net/scrapeTodaysData"

exports.scheduledScrapeTodaysData = functions.pubsub.schedule('30 9 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{
  url = PRODUCTION_URL
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


// exports.playground = functions.https.onRequest((request, response) => {
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
//   gettingDates.then(data=>response.send(data)).catch(error=>response.send(error))
//
// });



exports.scrapeMunicipiosData = functions.https.onRequest((request, response) => {
  console.log("Scraiping data for municipios")
  var x = Xray()
  datesURL = "https://github.com/Code4PuertoRico/covid19-pr-api/tree/master/data"

  gettingDates = new Promise((resolve,reject)=>{
    x(datesURL, 'ol',['li'])((error,items)=>{
      if (error){
        reject(error)
      } else{
        resolve(items)
      }
    })
  })


  gettingDates
  .then(dates=>{
    lastDate = dates[dates.length - 1]
    console.log("Last date is "+lastDate)

    splitUp = lastDate.split("-") // date is in form 04-11-2020
    month = parseInt(splitUp[0]) // has to be in single digit form for URL, others don't
    day = splitUp[1]
    year = splitUp[2]

    const url = `https://raw.githubusercontent.com/Code4PuertoRico/covid19-pr-api/master/data/PuertoRicoTaskForce/${month}-${day}-${year}/CSV/municipios.csv`
    console.log(`GET ${url}`)
    return fetch(url,{method:'GET'})
  })
  .then(data=>{
    return data.buffer()
  })
  .then(buffer=>{
    var text = buffer.toString()
    // clean out quote chars
    text = text.replace(/"/g, '')
    var rows = text.split("\n")
    console.log("ROWS",rows)
    for (var i = 0; i < rows.length; i++) {
      rows[i] = rows[i].split(",")
    }
    var municipiosData = {}
    for (var j = 2; j < rows.length; j++) {
      const row = rows[j]
      console.log(`Row is ${row}`)
      const MUNICIPIO_NAME_i = 0
      const CONFIRMED_CASES_i = 1

      var muncipioName = row[MUNICIPIO_NAME_i].slice(0,-1)
      // correct municipio names
      nameCorrections = {"Afasco":"Añasco","Bayamon":"Bayamón","Catano":"Cataño",
      "Guanica":"Guánica","Loiza":"Loíza","Manati":"Manatí","Mayaguez":"Mayagüez",
      "Rincon":"Rincón","Sabana Grande":"Sábana Grande","San German":"San Germán",
      "San Sebastian":"San Sebastián"}
      if (muncipioName in nameCorrections){
        muncipioName = nameCorrections[muncipioName]
      }


      const confirmedCases = parseInt(row[CONFIRMED_CASES_i])
      if (muncipioName.length > 0){
        municipiosData[muncipioName] = {confirmedCases:confirmedCases}
      }
    }
    return municipiosData
  })
  .then(municipiosData=>{
    municipiosData["timestamp"] = getTimeStamp()

    let ref = admin.firestore().doc("data/municipios")
    return ref.set({all:municipiosData})

  })
  .then(data=>response.send(data))
  .catch(error=>{
    return response.send(error)
  })

});

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
      return response.send("Updated data succesfully")
    })
    .catch(error=>{
      const errorMessage = "Error updating historical data\n"+error
      response.send(errorMessage)
  })

});



exports.scheduledHistoryAddToday = functions.pubsub.schedule('0 10 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{
    TESTING_URL = "http://localhost:5001/covid19puertorico-1a743/us-central1/logTodaysDataToHistory"
    PRODUCTION_URL = "https://us-central1-covid19puertorico-1a743.cloudfunctions.net/logTodaysDataToHistory"

    url = PRODUCTION_URL
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

const getTodaysMessage = async () =>{


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
        newCasesToday:historicalData[lengthOfData-1].confirmedCases - historicalData[lengthOfData-2].confirmedCases,
        newDeathsToday:historicalData[lengthOfData-1].deaths - historicalData[lengthOfData-2].deaths,
        newMolecularTestsToday:historicalData[lengthOfData-1].molecularTests - historicalData[lengthOfData-2].molecularTests,
        newSerologicalTestsToday:historicalData[lengthOfData-1].serologicalTests - historicalData[lengthOfData-2].serologicalTests,
        }
    }
    else{
      return {dataAvailable:false}
    }
  })

  return Promise.all([todaysData,historicalDataFromFireBase])
  .then(data=>{
    let today = data[0]
    let historical = data[1]
    var message = `Tracker COVID-19 Puerto Rico\n`
    message += `Casos positivos: ${formatInteger(today.confirmedCases)} (+${formatInteger(historical.newCasesToday)} hoy)\n`
    message += `Muertes: ${formatInteger(today.deaths)} (+${formatInteger(historical.newDeathsToday)} hoy)\n`
    message += "- - - - - - \n"
    message += `${today.saludTimeSignature}`

    return message

    })
  .catch(error=>error)
}





const accountSid = keys.twilio.twilio_account_sid; // Your Account SID from www.twilio.com/console
const authToken = keys.twilio.twilio_auth_token;   // Your Auth Token from www.twilio.com/console

const twilio = require('twilio');
const client = new twilio(accountSid, authToken);

const sendSMS = async (message,number) => {

  client.messages.create({
      body: message,
      to: number,  // Text this number
      from: '+12058096622' // From a valid Twilio number
  })
  .then((message) => {
    console.log(message.sid)
    return message.sid
  })
  .catch(error=>error);
}


exports.sendAllSMS = functions.https.onRequest(async(request, response) => {
  let message = await getTodaysMessage()
  let NUMBERS = keys.twilio.test_numbers
  for (var i = 0; i < NUMBERS.length; i++) {
    let destination = NUMBERS[i]
    sendSMS(message,destination)
  }
  return response.send("Executed all SMS messages")

});

exports.scheduledSMSQA = functions.pubsub.schedule('30 10 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{
    PRODUCTION_URL = "https://us-central1-covid19puertorico-1a743.cloudfunctions.net/sendAllSMS"

    url = PRODUCTION_URL
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


// exports.cleanHistoricalData = functions.https.onRequest((request, response) => {
//   let documentRef = admin.firestore().doc('data/historicalData');
//   documentRef.get()
//   .then(snapshot=>{
//     if (snapshot.exists){
//       var data = snapshot.data() // list of data per day
//       data = data.all
//       var cleanData = []
//       for (var i = 0; i < data.length; i++) {
//         var dataObject = data[i]
//         console.log(dataObject)
//         const confirmedCases = dataObject.confirmedCases
//         const timestamp = dataObject.timestamp
//         var newDataObject = {confirmedCases:confirmedCases,timestamp:timestamp}
//         if (day == 12){
//           newDataObject.conductedTests = 7973
//           newDataObject.testsInProgress = 1251
//           newDataObject.negativeCases = 5819
//           newDataObject.deaths = 44
//         }
//         else if (day == 13){
//           newDataObject.conductedTests = 8157
//           newDataObject.testsInProgress = 1288
//           newDataObject.negativeCases = 5960
//           newDataObject.deaths = 45
//         }
//         cleanData.push(newDataObject)
//       }
//     console.log("Clean data is\n",cleanData)
//     return documentRef.set({all:cleanData})
//     }
//     else{
//       return "Data not found"
//     }
//   })
//   .then(result=>response.send(result))
//   .catch(error=>response.send(error))
// });


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
