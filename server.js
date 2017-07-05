//TODO: figure out why there seems to be a double execute sometime with twitch
//passport

const SERVER = process.env.SERVER_URL || "test-eliotn.c9users.io";
const PORT = process.env.PORT || 3000;
const DROP_DATA = true;
const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/twitchvotes';
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const OAUTH_SECRET = process.env.OAUTH_SECRET;
const TWITCH_SECRET = process.env.TWITCH_SECRET;


//express
const express = require('express');
const app = express();

//setup file server
const path = require('path');
app.use(express.static(path.join(__dirname, 'static')));

var MongoClient = require('mongodb').MongoClient;

//allow JSON request bodies to be readable
const bodyParser = require('body-parser');
app.use(bodyParser.json());

//users contains the following
//access_token, userid, tokenUpdateTime
//polls contains the following
//userid, question, [answer], [votes]
var users;//get the collection
var polls;//get the polls
MongoClient.connect(MONGO_URL, function(err, database) {
    if (err) throw err;
    users = database.collection('users');
    polls = database.collection('polls');
    if (DROP_DATA) {//utility function to retest with new data
        users.drop();
        polls.drop();
        //tokens have a lifetime of 2400 seconds (60 minutes)
        users.createIndex({"tokenUpdateTime" : 1}, {"expireAfterSeconds" : 2400});
    }
});


//adds vote, requires number pollid and vote option
function addVote(pollid, vote, user) {
    console.log("Starting vote!");
    console.log(pollid);
    console.log(vote);
    var result_json = {};
    polls.findOne({"userid": Number(pollid)}, {}, function(err, results) {
        if (err) {
            result_json = {"err":err};
            return;
        }

        if (!results || vote < 0 || results.answers.length < vote ) {
            result_json = {"err": "Poll not found"};
            return;
        }
        polls.updateOne({"userid": Number(pollid)},
        {$inc: {["votes." + String(vote)]:1}}, function(err, results) {
                if (err) {result_json = {"err": err};}
                else {result_json = {"Note:": "vote counted"}};
        });
        console.log(user);
        if (user) {
            polls.updateOne({"userid": Number(pollid)}, {$push: {"usersvoted":user}});
        }

    });
    return result_json;
}

//creates a poll
function createPoll(pollid, question, answerlist) {
    var result_json = {};
    polls.findOne({"userid": Number(pollid)}, {}, function(err, results) {
        if (err) {
            result_json = {"err":err};
            return result_json;
        }
        //properly format answers
        var answers = answerlist;
        var votes = [];
        for (var answer in answerlist) {
            votes.push(0);
        }

        if (!results) {
            console.log("poll needs to be created");
            polls.insert({"usersvoted":[], "userid": Number(pollid), "question": question, "answers":answers, "votes":votes}, function (err) {
                if (err) result_json = {"err":err};
                else result_json = {"Note":"Poll added"};
            });
        }
        else {
            console.log("update poll with new information");
            polls.updateOne({"userid": Number(pollid)}, {$set: {"question":question, "answers":answers, "votes":votes}});
            result_json = {"Note":"Poll updated"};
        }
    });
    return result_json;
}


var tmi = require("tmi.js");
var request = require('request');
var client;
const fs = require('fs');
var channelToID = {};
    client = new tmi.client({
        identity: {
            username: "ejg_dnd",
            password: OAUTH_SECRET
        },
	options: {
    		debug: true,
  	},
  	connection: {
    		reconnect: true,
  	},
        channels: ['#hardlydifficult']
    });
    client.connect();
    client.on("chat", function(channel, userstate, message, self) {
        console.log("Chat message from " + channel);
        for (var i = 0; i < message.length; i++) {
            if (message.charCodeAt(i) >= 49 && message.charCodeAt(i) <= 57) {
                addVote(channelToID[channel], message.charCodeAt(i) - 49, userstate["user-id"]);
                return;
            }
        }


    });
    client.on("join", function(channel, username, self) {
        if (self) {
            var options = {
                url: "https://api.twitch.tv/kraken/users?login=" + channel.substring(1, channel.length),
                headers: {
                    'Client-ID': TWITCH_CLIENT_ID,
                    'Accept': "application/vnd.twitchtv.v5+json"
                }
            };
            request(options,
            function (err, request, body) {
                if (err) {
                    throw err;
                }
                //console.log(JSON.parse(body)["users"]);
                channelToID[channel] = Number(JSON.parse(body)["users"][0]["_id"]);
                var a = [];
                for (var i = 0; i < 4; i++) {
                    a.push(i);
                }
                createPoll(channelToID[channel], "What is 1+1?", a);
                console.log(channelToID);
            });
        }
    });



//use passport to connect with twitch and get an access key
const passport = require("passport");
app.use(passport.initialize());
app.use(passport.session());
var twitchStrategy = require("passport-twitch").Strategy;
var BearerStrategy = require("passport-http-bearer").Strategy;

//read secret from file before starting passport
passport.use(new twitchStrategy({
    clientID: TWITCH_CLIENT_ID,
    clientSecret: TWITCH_SECRET,
    callbackURL: "https://" + SERVER + "/auth/twitch/callback",
    scope: "user_read",
    session: false
}, function(accessToken, refreshToken, profile, done) {
    //do stuff with the user after you log them in
    users.findOne({"userid": profile.id}, function(err, results) {
        if (err) {
            return done(err);
        }
        if (!results) {
            console.log("user needs to be created");
            users.insert({"userid": profile.id, "username":profile.display_name, "access_token":accessToken, "tokenUpdateTime":new Date()}, function (err) {
                if (err) return done(err);
                return done(null, {"access_token":accessToken});
            });
        }
        else {
            console.log("user already logged in!");
            users.updateOne({"userid": profile.id}, {$set: {"access_token":accessToken, "tokenUpdateTime":new Date()}});
            return done(null, {"access_token":accessToken});
        }
    });
    console.log(JSON.stringify(profile));
     //put data we want access to in the callback here

}));


//authenticate based on token
passport.use(
    new BearerStrategy(
        function (token, done) {
            if (!token) {
                console.log("token not found");
                return done(null, false, {message: 'no token'});
            }
            users.findOne({"access_token": token}, function(err, result) {
                if (err) {
                    console.log("error in bearerstrategy" + err);
                    return done(err);
                }
                if (!result) {
                    console.log("incorrect token");
                    return done(null, false, {message: 'incorrect token'});
                }
                console.log("correct token");
                return done(null, result, {scope:'all'});
            });
        }
    )
);

//session is set to false because we aren't using sessions
//thanks https://jeroenpelgrims.com/token-based-sessionless-auth-using-express-and-passport
app.get('/auth/twitch/', passport.authenticate("twitch", {session: false}));
app.get('/auth/twitch/callback', passport.authenticate("twitch", {session:false, failureRedirect: '/'}), function (req, res) {

    res.redirect('/?access_token=' + req.user.access_token);
});
app.put('/api/vote/:pollid/:vote', function (req, res) {
    var voteresult = addVote(Number(req.params.pollid), req.params.vote-1);
    if ("err" in voteresult) {
        res.status(404).send();
        return;
    }
    res.json(voteresult)
});
app.get('/api/poll', passport.authenticate("bearer", {session: false}), function (req, res) {
   polls.findOne({"userid": req.user.userid}, {}, function(err, results) {
        if (err) {
            res.json({"err":err});
            return;
        }
        if (!results) {
            res.json({"err":"This user does not have a poll."});
            return;
        }
        var object = {"question":results.question, "answers":results.answers, "votes":results.votes};
        res.json(object);
        return;
    });
});
app.post('/api/poll', passport.authenticate("bearer", {session: false}), function (req, res) {
    console.log(req.body);
    if (req.body.question && req.body.answers) {
        client.join("#" + req.user.username);

        res.json(createPoll(Number(req.user.userid), req.body.question, req.body.answers));
        client.say("#" + req.user.username, "Poll has been created with question '" + req.body.question + "'");
    }

    else {
        res.json({"Note":"You posted an invalid poll"});
    }
});
app.get('/api/debug/testlogin',  passport.authenticate("bearer", {session: false}), function (req, res) {
    res.json({"Note":"Your userid is " + req.user.userid});
});
//dump the database output
app.get('/api/debug/users',  passport.authenticate("bearer", {session: false}), function (req, res) {
    users.find().toArray(function(err, result) {
        if (err) throw err;
        res.json({'users':JSON.stringify(result)});
    });
});
app.get('/api/debug/polls',  passport.authenticate("bearer", {session: false}), function (req, res) {
    polls.find().toArray(function(err, result) {
        if (err) throw err;
        res.json({'polls':JSON.stringify(result)});
    });
});


app.listen(PORT, function() {
    console.log("listening on port " + PORT);
});

//socket.io -- TODO: Implement for live updates
var io = require('socket.io').listen(app.server);
