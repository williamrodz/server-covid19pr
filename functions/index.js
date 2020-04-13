const functions = require('firebase-functions');
var admin = require("firebase-admin");

var serviceAccount = require("./privateKey.json")

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://covid19puertorico-1a743.firebaseio.com"
});


var Xray = require('x-ray')

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

DATA_LABELS = ["conductedTests","confirmedCases","negativeCases","testsInProgress","deaths"]

attachLabels = (data,labels) =>{
  output = {}
  for (var i = 0; i < labels.length; i++) {
    output[labels[i]] = data[i]
  }
  return output
}

getTimeStamp = ()=>{
  let today = new Date()
  let month = today.getMonth() + 1
  let day = today.getDate()
  let year = today.getFullYear()
  let hour = today.getHours()
  let minutes = today.getMinutes()

  return {month:month,day:day,year:year,hour:hour,minutes:minutes}
}

exports.scrapeTodaysDataScheduled = functions.pubsub.schedule('5 9 * * *')
  .timeZone('America/New_York') // Users can choose timezone - default is America/Los_Angeles
  .onRun((context) => {
  console.log("Scraping Today's Data:This will be run every day at 9:05 AM Eastern!");
  var x = Xray()

  x(salud_web_site_url, '.ms-rteElement-H3B')((err, item) =>{
    let ref = admin.firestore().doc("data/todaysData")
    ref.update({saludTimeSignature:item})
    .then(console.log("completed updating salud time signature"))
    .catch(error=>{
      const errorMessage = "Error obtaining salud time signature\n"+error
      console.log(errorMessage,err)
    })
  })



  x(salud_web_site_url, ['.ms-rteElement-H2B'])((err, items) =>{
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
    const timeDimensions = Object.keys(timestamp)
    for (var i2 = 0; i2 < timeDimensions.length; i2++) {
      dimension = timeDimensions[i2]
      labeledData[dimension] = timestamp[dimension]
    }


    let ref = admin.firestore().doc("data/todaysData")
    ref.set(labeledData)
    .then(console.log("Wrote new entry\n",labeledData))
    .catch(error=>{
      const errorMessage = "Error scraping/writing\n"+error
      console.log(errorMessage,err)
    })
  })


  return null;
});

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
    const timeDimensions = Object.keys(timestamp)
    for (var i2 = 0; i2 < timeDimensions.length; i2++) {
      dimension = timeDimensions[i2]
      labeledData[dimension] = timestamp[dimension]
    }


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


exports.addTodaysDataToHistoryScheduled = functions.pubsub.schedule('10 9 * * *')
  .timeZone('America/New_York') // Users can choose timezone - default is America/Los_Angeles
  .onRun((context) => {
  console.log("Adding Today's Data to History This will be run every day at 9:10 AM Eastern!");

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
      'last7Days', admin.firestore.FieldValue.arrayUnion(newDataEntry)
    )
  })
    .then(data => {
      console.log("Updated data succesfully")
      return true
    })
    .catch(error=>{
      const errorMessage = "Error updating historical data\n"+error
      console.log(errorMessage)
  })





  return null;
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
      'last7Days', admin.firestore.FieldValue.arrayUnion(newDataEntry)
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
