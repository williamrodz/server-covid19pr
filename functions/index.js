const functions = require('firebase-functions');
var admin = require("firebase-admin");

var serviceAccount = require("./privateKey.json")

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://covid19puertorico-1a743.firebaseio.com"
});


var Xray = require('x-ray')
var fetch = require("node-fetch");


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

exports.getTodaysData = functions.https.onRequest((request, response) => {
  let ref = admin.firestore().doc("data/todaysData")
  ref.get()
  .then(snapshot=>{
    if (snapshot.exists){
      console.log("Retrieved today's data succesfully")
      let data = snapshot.data()
      return response.send(data)
    } else{
      return response.send("Today's data does not exist")
    }
  })
  .catch(error=>{
    const errorMessage = "Error retrieving today's data\n"+error
    response.send(errorMessage)
  })
});

exports.scrapeManually = functions.https.onRequest((request, response) => {
  var x = Xray()

  x(salud_web_site_url, '.ms-rteElement-H3B')((err, item) =>{
    let ref = admin.firestore().doc("data/todaysData")
    ref.update({saludTimeSignature:item})
    .then(console.log("completed updating salud time signature"))
    .catch(error=>{
      const errorMessage = "Error obtaining salud time signature\n"+error
      console.log(errorMessage,err)
      response.send(errorMessage)
    })
  })



  x(salud_web_site_url, ['.ms-rteElement-H2B'])((err, items)=> {
    integers = []
    for (var i = 0; i < items.length; i++) {
      string = items[i]
      console.log(string)
      if (string.indexOf("COVID") === -1){// if firstChar starts with a number
        integers.push(parseInt(cleanString(string)))
      }
    }
    labeledData = attachLabels(integers,DATA_LABELS)
    timestamp = getTimeStamp()
    // labeledData["saludTimestampSignature"] = saludTimestampSignature
    labeledData["timestamp"] = timestamp

    let ref = admin.firestore().doc("data/todaysData")
    ref.set(labeledData)
    .then(response.send(labeledData))
    .catch(error=>{
      const errorMessage = "Error scraping/writing\n"+error
      console.log(errorMessage,err)
      response.send(errorMessage)
    })
  })
});
//
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
//           newDataObject.saludTimeSignature = "(Datos al 12 de abril de 2020, 7:00 am)"
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
//
//
// });



processCSVText = (text) =>{
  rows = text.split("\n")
  for (var i = 0; i < rows.length; i++) {
    rows[i] = rows[i].split(",")
  }
  var municipiosData = {}
  for (var j = 0; j < rows.length; j++) {
    const row = rows[j]
    const MUNICIPIO_NAME_i = 0
    const CONFIRMED_CASES_i = 1
    const muncipioName = row[MUNICIPIO_NAME_i]
    const confirmedCases = row[CONFIRMED_CASES_i]
    municipiosData.muncipioName = {confirmedCases:confirmedCases}
  }

  return municipiosData

}

cleanTrailingWhitespace = (text) =>{
  var lastTextIndex = 0
  for (var i = 0; i < text.length; i++) {
    if (text[i] !==" "){
      lastTextIndex = i
    }
  }
  return text.substring(0,lastTextIndex+1)
}

exports.scrapeMunicipiosData = functions.https.onRequest((request, response) => {
  const month = 4
  const day = 11
  const year = 2020
  const url = `https://raw.githubusercontent.com/Code4PuertoRico/covid19-pr-api/master/data/PuertoRicoTaskForce/${month}-${day}-${year}/CSV/municipios.csv`
  console.log(`GET ${url}`)
  return fetch(url,{method:'GET'})
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
      const confirmedCases = parseInt(row[CONFIRMED_CASES_i])
      if (muncipioName.length > 0){
        municipiosData[muncipioName] = {confirmedCases:confirmedCases}
      }
    }
    return municipiosData
  })
  .then(municipiosData=>{

    let ref = admin.firestore().doc("data/municipios")
    return ref.set(municipiosData)

  })
  .then(data=>response.send(data))
  .catch(error=>{
    return response.send(error)
  })

});




exports.addTodaysDataToHistoryManually = functions.https.onRequest((request, response) => {
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
