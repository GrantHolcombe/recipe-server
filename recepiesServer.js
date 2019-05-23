const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const MongoClient = require('mongodb').MongoClient;
const ObjectId = require("mongodb").ObjectID;
const uri = process.env.MONGOURI;
const client = new MongoClient(uri, { useNewUrlParser: true });
var database, collection, appUsersCollection;

const multer = require('multer');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
const awsKey = process.env.AWSKEY;
const awsSecret = process.env.AWSSECRET;

aws.config.update({
    // Your SECRET ACCESS KEY from AWS should go here,
    // Never share it!
    // Setup Env Variable, e.g: process.env.SECRET_ACCESS_KEY
    secretAccessKey: awsSecret,
    // Not working key, Your ACCESS KEY ID from AWS should go here,
    // Never share it!
    // Setup Env Variable, e.g: process.env.ACCESS_KEY_ID
    accessKeyId: awsKey,
    region: 'us-east-1' // region of your bucket
});

const s3 = new aws.S3();

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'recipe-app-imgs',
    acl: 'public-read',
    metadata: function (req, file, cb) {
      cb(null, {fieldName: file.fieldname});
    },
    key: function (req, file, cb) {
      cb(null, Date.now().toString())
    }
  })
})


const singleUpload = upload.single('image')

var BodyParser = require("body-parser")
, cookieParser     = require( 'cookie-parser' )
, session          = require( 'express-session' )
, RedisStore       = require( 'connect-redis' )( session );

  const express = require('express'),
    app = express(),
    port = process.env.PORT || 3000;

    app.use(cors({origin: process.env.ORIGIN}));
    app.use(BodyParser.json());
    app.use(BodyParser.urlencoded({ extended: true }));


    const cookieSession = require('cookie-session');


const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

// API Access link for creating client ID and secret:
// https://code.google.com/apis/console/
var GOOGLE_CLIENT_ID      = process.env.GOOGLEID
  , GOOGLE_CLIENT_SECRET  = process.env.GOOGLESECRET;



// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Google profile is
//   serialized and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});


// Use the GoogleStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and Google
//   profile), and invoke a callback with a user object.
passport.use(new GoogleStrategy({
    clientID:     GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    //NOTE :
    //Carefull ! and avoid usage of Private IP, otherwise you will get the device_id device_name issue for Private IP during authentication
    //The workaround is to set up thru the google cloud console a fully qualified domain name such as http://mydomain:3000/
    //then edit your /etc/hosts local file to point on your private IP.
    //Also both sign-in button + callbackURL has to be share the same url, otherwise two cookies will be created and lead to lost your session
    //if you use it.
    callbackURL: process.env.ORIGIN + "/auth/google/callback",
    passReqToCallback   : true
  }, (request, accessToken, refreshToken, profile, done) => {
       done(null, profile);
  }
));

// set up session cookies
app.use(cookieSession({
    maxAge: 24 * 60 * 60 * 1000,
    keys: ['coolbeans']
}));

// initialize passport
app.use(passport.initialize());
app.use(passport.session());

app.listen(3000, () => {
    MongoClient.connect(uri, { useNewUrlParser: true }, (error, client) => {
        if(error) {
            throw error;
        }
        var DATABASE_NAME = 'recipeBook'
        database = client.db(DATABASE_NAME);
        collection = database.collection("recipes");
        console.log("Connected to `" + DATABASE_NAME + "`!");
    });
});


app.post('/image-upload', function(req, res) {
  singleUpload(req, res, function(err, some) {
    if (err) {
      return res.status(422).send({errors: [{title: 'Image Upload Error', detail: err.message}] });
    }

    return res.json({'imageUrl': req.file.location});
  });
})



app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));


// GET /auth/google/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get( '/auth/google/callback',
    	passport.authenticate( 'google'), (req,res) =>{
        res.redirect('/')
      });

const authCheck = (req, res, next) => {
    if(!req.isAuthenticated()){
        res.redirect('/auth/google');
    } else {
        next();
    }
};

app.use('/',authCheck, express.static('build'));

app.get('/logout', (req, res) => {
    req.logOut();
    res.redirect('/');
    // res.redirect('https://accounts.google.com/logout');
});

app.get("/all", authCheck, (request, response) => {
    collection.find({googleId: request.user.id}).toArray((error, result) => {
        if(error) {
            return response.status(500).send(error);
        }
        response.send(result);
    });
});

app.post("/single/:id", authCheck, (request, response) => {
    collection.find({"_id": new ObjectId(request.params.id)}).toArray((error, result) => {
        if(error) {
            return response.status(500).send(error);
        }
        response.send(result);
    });
});

app.post("/new", authCheck, (request, response) => {
  request.body.googleId = request.user.id
  collection.insertOne(request.body, (error, result) => {
      if(error) {
          return response.status(500).send(error);
      }
      response.send(result);
  });
});

app.post("/update/:id", authCheck, (request, response) => {
  const id = new ObjectId(request.params.id)

  const update = {
    dishName: request.body.dishName,
    ingredients: request.body.ingredients,
    instructions: request.body.instructions,
    imageUrl: request.body.imageUrl
  }
  collection.updateOne({"_id":id},{$set:update}, (error, result) => {
      if(error) {
          return response.status(500).send(error);
      }
      response.send(result);
  });
});

app.post("/loadDish/:id", authCheck, (request, response) => {
  const id = new ObjectId(request.params.id)
  collection.find({ "_id": id }).toArray((error, result) => {
      if(error) {
          return response.status(500).send(error);
      }
      response.send(result);
  });
});

app.post("/search/:q", authCheck, (request, response) => {
    var params = request.params.q
    var googleId = request.user.id
    params = params.split(', ');
      collection.find({ "ingredients": {$elemMatch:{"ingName": { $in: params } } }, "googleId": googleId }).project({dishName:1}).toArray((error, result) => {
          if(error) {
              return response.status(500).send(error);
          }
          response.send(result);
      });

});

app.get("/delete/:id", authCheck, (request, response) => {
    collection.remove({ "_id": new ObjectId(request.params.id) }, (error, result) => {
      if(error) {
          return response.status(500).send(error);
      }
      response.send(result);
  });
});
