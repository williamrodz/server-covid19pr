const functions = require('firebase-functions');
var admin = require("firebase-admin");
var serviceAccount = require("./privateKey.json")
var bluepromise = require('bluebird');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
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

exports.serverTimeCheck = functions.https.onRequest((request, response) => {
 response.send(new Date().toLocaleString('en-US',{timeZone:'America/La_Paz'}));
});



DATA_LABELS = ["conductedTests","confirmedCases","negativeCases","testsInProgress","deaths"]

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

exports.scheduledScrapeTodaysData = functions.pubsub.schedule('0 8 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{
  url = PRODUCTION_URL
  fetch(url,{method:'GET'})
  .then(data=>{
    console.log("Success scraping today's numbers: "+data)
    return null
  })
  .catch(error=>{
    console.log("Error scraping today's number: "+error)
    return null
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

    let ref = admin.firestore().doc("data/municipios")
    return ref.set({all:municipiosData})

  })
  .then(data=>response.send(data))
  .catch(error=>{
    return response.send(error)
  })

});


exports.scheduledMunicipioScrape = functions.pubsub.schedule('0 10 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{
    TESTING_URL = "http://localhost:5001/covid19puertorico-1a743/us-central1/scrapeMunicipiosData"
    PRODUCTION_URL = "https://us-central1-covid19puertorico-1a743.cloudfunctions.net/scrapeMunicipiosData"

    url = PRODUCTION_URL
    fetch(url,{method:'GET'})
      .then(data=>{
          console.log("Success adding today's data to history: "+data)
          return null
        })
      .catch(error=>{
        console.log("Error adding today's data to history: "+error)
        return null
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
      return response.send("Updated data succesfully")
    })
    .catch(error=>{
      const errorMessage = "Error updating historical data\n"+error
      response.send(errorMessage)
  })

});



exports.scheduledHistoryAdd = functions.pubsub.schedule('5 8 * * *')
  .timeZone('America/La_Paz')
  .onRun((context)=>{
    TESTING_URL = "http://localhost:5001/covid19puertorico-1a743/us-central1/logTodaysDataToHistory"
    PRODUCTION_URL = "https://us-central1-covid19puertorico-1a743.cloudfunctions.net/logTodaysDataToHistory"

    url = PRODUCTION_URL
    fetch(url,{method:'GET'})
      .then(data=>{
          console.log("Success adding today's data to history: "+data)
          return null
        })
      .catch(error=>{
        console.log("Error adding today's data to history: "+error)
        return null
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
