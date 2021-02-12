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
        response.send('Post added: ' + fields.id)
      })
    }
  })
  request.pipe(busboy)
})
/* 
  listen 
*/

app.listen(process.env.PORT || 3000);
