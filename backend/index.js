/*
  dependencies 
*/

const express = require("express");
const admin = require("firebase-admin");
let Busboy = require("busboy");
const inspect = require('util').inspect;
let  path = require('path')
let os = require('os')
let fs = require('fs')
let UUID = require('uuid-v4')
let webpush = require('web-push')
/*
  config - express 
*/

const app = express();

/* 
  config - firebase 
*/

const serviceAccount = require("./serviceAccountKey.json");
//const { uid } = require("quasar");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "instagram-clone-cad39.appspot.com"
});

const db = admin.firestore();
let bucket = admin.storage().bucket();

/* 
  config - webpush hihihi2222
*/

webpush.setVapidDetails(
  'mailto:pointmekin@gmail.com',
  'BAkRmEKQDos_BNQfHfBuynJAwIFiNZVRLNGPb8_2ykEikEHfEtOHgoax4R82-0lSzM7Ekcz1Kk92dHLetmGj08I',
  'TxOpYH_I_bCA2fswKOF6Sb6DnZlxp6UX_nuncAx3S_4'
);

/*
  endpoint - posts
*/

app.get("/", (request, response) => {
  response.send("Instagram Clone backend");
});

app.get("/posts", (request, response) => {
  response.set("Access-Control-Allow-Origin", "*");
  let posts = [];
  db.collection("posts")
    .orderBy("date", "desc")
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        posts.push(doc.data());
      });
      response.send(posts);
    });
});

/*
  endpoint - create posts
*/

app.post("/createPost", (request, response) => {
  response.set("Access-Control-Allow-Origin", "*");
  const uuid = UUID()
  const busboy = new Busboy({ headers: request.headers });
  let fields = {}
  let fileData = {}
  
  busboy.on("file", function(fieldname, file, filename, encoding, mimetype) {

    
    let filepath = path.join(os.tmpdir(), filename)
    file.pipe(fs.createWriteStream(filepath))
    fileData = { filepath, mimetype }
  });

  busboy.on("field", function(
    fieldname,
    val,
    fieldnameTruncated,
    valTruncated,
    encoding,
    mimetype
  ) {
    fields[fieldname] = val
  });
  // Finish hook
  busboy.on("finish", function() {

    bucket.upload(
      fileData.filepath,
      {
        uploadType: 'media',
        metadata: {
          metadata: {
            contentType: fileData.mimetype,
            firebaseStorageDownloadTokens: uuid
          }
        }
      },
      (err, uploadedFile) => {
        if (!err) {
          createDocument(uploadedFile)
        } else {
          console.log(err)
        }
      }
    )

    function createDocument(uploadedFile) {
      db.collection('posts').doc(fields.id).set({
        id: fields.id,
        caption: fields.caption,
        location: fields.location,
        date: parseInt(fields.date),
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${ bucket.name }/o/${ uploadedFile.name }?alt=media&token=${ uuid }`
      }).then(() => {
        sendPushNotification()
        response.send('Post added: ' + fields.id)
      })
    }

    function sendPushNotification() {

      let subscriptions = [];
      db.collection("subscriptions")
        .get()
        .then(snapshot => {
          snapshot.forEach(doc => {
            subscriptions.push(doc.data());
          });
          return subscriptions
        }).then(subscriptions => {
          subscriptions.forEach(subscription => {
            //if (subscription.endpoint.startsWith('https://fcm.googleapis.com'))
            const pushSubscription = {
              endpoint: subscription.endpoint,
              keys: {
                auth: subscription.keys.auth,
                p256dh: subscription.keys.p256dh
              }
            };
            let pushContent = {
              title: 'New Quasagram Post!',
              body: 'New Post Added! Check it out!',
              openUrl: '/#/'
            }
            let pushContentStringified = JSON.stringify(pushContent)
            webpush.sendNotification(pushSubscription, pushContentStringified);
          })
        }) 

    }

  })
  request.pipe(busboy)
})


/*
  endpoint - create post subscription
*/

app.post("/createSubscription", (request, response) => {
  response.set("Access-Control-Allow-Origin", "*");
  db.collection('subscriptions').add(request.query)
  .then(() => {
    response.send({
      message: 'Subscription added!',
      postData: request.query
    })
  })
})

/* 
  listen 
*/
app.listen(process.env.PORT || 3000);
