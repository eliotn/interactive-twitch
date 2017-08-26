const SERVER = process.env.SERVER_URL || "https://test-eliotn.c9users.io";
const PORT = process.env.PORT || 3000;
const DROP_DATA = false;
const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/twitchvotes';
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const OAUTH_SECRET = process.env.OAUTH_SECRET;
const TWITCH_SECRET = process.env.TWITCH_SECRET;
const HASH_SECRET = process.env.HASH_SECRET || "INTERACTIVE_TWITCH";
//express
const express = require('express');
const app = express();

//setup file server
const path = require('path');
var Promise = require('bluebird');


var MongoClient = require('mongodb').MongoClient;

//allow JSON request bodies to be readable
const bodyParser = require('body-parser');
app.use(bodyParser.json());

//users contains the following
//access_token, userid, tokenUpdateTime
//polls contains the following
//userid, pollid, question, [answer], [votes]
//tokens contains a list of tokens for different users
var users; //get the collection
var polls; //get the polls
var tokens;
var counters;
//Connect to database and reference collections
MongoClient.connect(MONGO_URL).then(function(database) {
    users = database.collection('users');
    polls = database.collection('polls');
    tokens = database.collection('tokens');
    counters = database.collection('counters');
    if (DROP_DATA) { //utility function to retest with new data
        users.drop();
        polls.drop();
        tokens.drop();
        counters.drop();
        //tokens have a lifetime of 2400 seconds (60 minutes)
        tokens.createIndex({
            "tokenUpdateTime": 1
        }, {
            "expireAfterSeconds": 2400
        });
        counters.insert( { "_id": "pollcounter", "seq":1} );
    }
}, function(err) {
    throw err;
});

var Hashids = require('hashids')
var hashids = new Hashids(HASH_SECRET);

function deletePoll(pollid) {
    return new Promise(function(resolve, reject) {polls.findOneAndDelete({
        "pollid": pollid
    }, function(err, res) {
        if (err) reject({
            "err": err
        });
        else if (res) {
            resolve({});
        }
        else {
            reject({
                "err": "resource not found"
            });
        }
    })});
}


//Returns a promise that adds a vote, requires number pollid and vote option
function addVote(pollid, vote, user) {
    console.log("Starting vote!");
    console.log(pollid);
    console.log(vote);
    var result_json = {};
    var p = new Promise(function(resolve, reject) {polls.findOne({
        "pollid": pollid
    }, function(err, result){if (err){ reject(err);}else{ resolve(result);}})})
    .then( function(results) {
         return new Promise(function(resolve, reject) {
            if (!results) {
                reject("Poll not found");
            }
            else if (vote < 0 || results.answers.length - 1 < vote) {
                reject("Invalid vote");
            }
            else if (results.usersvoted.indexOf(Number(user)) != -1) {
                reject("You already voted");
            }
            else {
               polls.updateOne({
                    "pollid": pollid
                }, {
                    $inc: {
                        ["votes." + String(vote)]: 1
                    }
                }, function(err, result) {console.log("vote finished"); if (err){ reject(err);}else{ resolve(result);}})
            }
        });
    }).then(function(results){
        return new Promise(function(resolve, reject) {polls.updateOne({
                    "pollid": pollid
                }, {
                    $push: {
                        "usersvoted": Number(user)
                    }
                }, function(err, result){if (err){ reject(err);}else{ resolve(result);}})});
    }).then(function(results) {
          
        return Promise.resolve({"Note:":"vote counted"});
    })
    .catch(function(err) {
        console.log(err);
        return Promise.reject({"err": err});
    });
    return p;
}

//returns a promise that will create the poll
function createPoll(userid, question, answerlist) {
    var answers = answerlist;
    var votes = [];
    //create list of answers and # of votes
    for (var answer in answerlist) {
        votes.push(0);
    }
    //update the poll id counter
    return new Promise(function(resolve, reject) {counters.findOneAndUpdate({ _id: "pollcounter" },
    { $inc: { seq: 1 } }, function(err, results){if (err) {reject(err)} else {resolve(results)}})})
    .then(function(result) {
            console.log(result.value)
            var pollid = hashids.encode(result.value.seq);
            console.log("Creating poll with id " + pollid);
            //insert poll
            return new Promise(function(resolve, reject) {polls.insert({
                "usersvoted": [],
                "userid": Number(userid),
                "pollid": pollid,
                "question": question,
                "answers": answers,
                "votes": votes
                }, function(err, results){if (err) {reject(err)} else {resolve(pollid)}});
            });
                
        })
    .then(function(pollid) {return {"note":"Poll Added", "id":pollid};})
    .catch(function(err) {return Promise.reject({"err":err})});
}


var tmi = require("tmi.js");
var request = require('request');
var client;
const fs = require('fs');
//var channelToID = {};
var channelToPoll = {};//
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
    channels: []
});
client.connect();

//triggers when a user submits a chat message to a channel I am watching
client.on("chat", function(channel, userstate, message, self) {
    console.log(message);
    var number = /[1-9][0-9]*/;
    var match = number.exec(message);
    if (match) {
        addVote(channelToPoll[channel], Number(match) - 1, userstate["user-id"])
        .catch(function(err) {console.log(err);});
    }


});
//triggers when a user joins
client.on("join", function(channel, username, self) {
    if (self) {//when I join (only works if joining a channel in the channel's list)
        var options = {
            url: "https://api.twitch.tv/kraken/users?login=" + channel.substring(1, channel.length),
            headers: {
                'Client-ID': TWITCH_CLIENT_ID,
                'Accept': "application/vnd.twitchtv.v5+json"
            }
        };
        //Test function, creates a test poll for existing channels
        request(options,
            function(err, request, body) {
                if (err) {
                    throw err;
                }
                //console.log(JSON.parse(body)["users"]);
                var a = [];
                for (var i = 0; i < 4; i++) {
                    a.push(i);
                }
                createPoll(Number(JSON.parse(body)["users"][0]["_id"]), "What is 1+1?", a);
            }
        );
    }
});



//use passport to connect with twitch and get an access key
const passport = require("passport");
app.use(passport.initialize());
app.use(passport.session());
var twitchStrategy = require("passport-twitch").Strategy;
var BearerStrategy = require("passport-http-bearer").Strategy;

passport.use(new twitchStrategy({
    clientID: TWITCH_CLIENT_ID,
    clientSecret: TWITCH_SECRET,
    callbackURL: SERVER + "/auth/twitch/callback",
    scope: "user_read",
    session: false
}, function(accessToken, refreshToken, profile, done) {//change state after a login
    
    
            console.log(profile);
            tokens.insert({
                "userid": profile.id,
                "username": profile.displayName,
                "access_token": accessToken,
                "tokenUpdateTime": new Date()
            });
            users.update({
                "userid": profile.id
            },
            {
                $set: {
                    "username": profile.displayName
                }
            },
            {
                upsert:true
            });
        return done(null, {//put data we want access to in the callback here
            "userid": profile.id,
            "access_token": accessToken
        });
    

}));


//authenticate based on token
passport.use(
    new BearerStrategy(
        function(token, done) {
            if (!token) {
                console.log("token not found");
                return done(null, false, {
                    message: 'no token'
                });
            }
            tokens.findOne({
                "access_token": token
            }, function(err, result) {
                if (err) {
                    console.log("error in bearerstrategy" + err);
                    return done(err);
                }
                if (!result) {
                    console.log("incorrect token");
                    return done(null, false, {
                        message: 'incorrect token'
                    });
                }
                console.log("correct token");
                return done(null, result, {
                    scope: 'all'
                });
            });
        }
    )
);

//session is set to false in api calls because we aren't using sessions
//thanks https://jeroenpelgrims.com/token-based-sessionless-auth-using-express-and-passport

//Login with twitch api
app.get('/auth/twitch/', passport.authenticate("twitch", {
    session: false
}));
//callback from twitch api when the login is successful
app.get('/auth/twitch/callback', passport.authenticate("twitch", {
    session: false,
    failureRedirect: '/'
}), function(req, res) {

    res.redirect('/activity/' + req.user.userid + '?access_token=' + req.user.access_token);
});

//Logout from current device
app.get('/auth/logout', passport.authenticate("bearer", {
    session: false
}), function(req, res) {
    tokens.remove({
        "access_token": { $eq: req.user.access_token }
    }, function(err) {
        if (err) { console.log(err); }
        req.logout();
        res.redirect('/');
    });
    
});

//add a vote to the current poll
app.put('/api/vote/:pollid/:vote', function(req, res) {
    Promise.resolve(addVote(req.params.pollid, req.params.vote - 1)).then(
        function (voteresult) {
            console.log("voted");
            res.json(voteresult)
        },
        function (error) {
            console.log("vote failed");
            res.status(404).send();
        }
    );
    
    
});

//get all polls for a user
app.get('/api/poll', passport.authenticate("bearer", {
    session: false
}), function(req, res) {
    polls.find({
        "userid": req.user.userid
    }).toArray(function(err, results) {
        if (err) {
            res.json({
                "err": err
            });
            return;
        }
        if (!results) {
            res.json({
                "err": "This user does not have a poll."
            });
            return;
        }
        var result_json = [];
        for (var poll of results) {
            console.log(poll);
            var poll_representation = {
            "question": poll.question,
            "answers": poll.answers,
            "votes": poll.votes
            };
            result_json.push(poll_representation);
        }
        console.log(result_json);
        res.write(JSON.stringify({"polls":result_json}));
        res.end();
        return;
    });
});

//Post - creates a new poll, requires json in
app.post('/api/poll', passport.authenticate("bearer", {
    session: false
}), function(req, res) {
    console.log(req.body);
    if (!req.body.question) {
        res.json({
            "err": "A new poll needs a question"
        });
    }
    else if (!(req.body.answers instanceof Array)) {
        res.json({
            "err": "A new poll needs a list of answers"
        });
        
    }

    else {
        client.join("#" + req.user.username);

        Promise.resolve(createPoll(Number(req.user.userid), String(req.body.question), req.body.answers))
        .then(function(result_json) {
            res.json(result_json);
            channelToPoll["#" + req.user.username] = result_json["id"];
            client.say("#" + req.user.username, "Poll has been created with question '" + req.body.question + "'");
            
        })
        .catch(function(err_json) {
            res.json(err_json);
        });
        
    }
});

app.delete('/api/poll/:pollid', passport.authenticate("bearer", {
    session: false
}), function(req, res) {
    deletePoll(req.params.pollid)
    .then(function(result) {
        client.say("#" + req.user.username, "The poll is over!");
        client.part('#' + req.user.username);
        res.status(204).send("Deleted");
    })
    .catch(function (err) {
        res.status(204).send(err["err"]);
    });
    
});

//debug functions don't use in production server
if (process.env.DEBUG_MODE) {
    app.get('/api/debug/testlogin', passport.authenticate("bearer", {
        session: false
    }), function(req, res) {
        res.json({
            "Note": "Your userid is " + req.user.userid
        });
    });

    app.get('/api/debug/users', function(req, res) {
        users.find().toArray(function(err, result) {
            if (err) throw err;
            res.json({
                'users': JSON.stringify(result)
            });
        });
    });

    app.get('/api/debug/polls', function(req, res) {
        polls.find().toArray(function(err, result) {
            if (err) throw err;
            res.json({
                'polls': JSON.stringify(result)
            });
        });
    });
    
    app.get('/api/debug/tokens', function(req, res) {
        tokens.find().toArray(function(err, result) {
            if (err) throw err;
            res.json({
                'tokens': JSON.stringify(result)
            });
        });
    });
}

//keep css/js files publicly accessible
app.get('/css/:filename', function(req, res) {
    res.sendFile(path.join(__dirname, 'static/css/' + req.params.filename));
});
app.get('/js/:filename', function(req, res) {
    res.sendFile(path.join(__dirname, 'static/js/' + req.params.filename));
});
app.get('/js/vendor/:filename', function(req, res) {
    res.sendFile(path.join(__dirname, 'static/js/vendor/' + req.params.filename));
});

//http templating used for index and activity pages
var mustache = require('mustache');

function getIndex(req, res, next, user) {
    var template = {};
    if (user) {
        template.user = user.username;
        template.userid = user.userid;
    }
    polls.find().toArray(function(err, result) {
        if (err) {
            console.log(err);
            res.status(404).send("Could not load polls.");
            return;
        }
        if (result) {
            template.polls = [];
            var usersWithPolls = {};
            for (var i = 0; i < result.length; i++) {
                usersWithPolls[result[i].userid] = true;
                
            }
            for (var v in usersWithPolls) {
                template.polls.push(v);
            }
        }
        fs.readFile(path.join(__dirname, 'static/index.html'), function response(err, html) {
            if (err) console.log(err);
            res.write(mustache.to_html(html.toString('utf-8'), template));
            res.end();
        });
    });
}

function getActivity(req, res, next, user) {
    var template = {};
    console.log(user);
    if (user) {
        template.user = user.username;
    }
    polls.find({
        "userid": Number(req.params.userid)
    }).toArray(function(err, results) {
        if (err) console.log(err);
        console.log(results);
        var answers = [];
        //I am logged in and viewing my poll view/creation
        if (user && user.userid == req.params.userid) {
            if (results && results.length > 0) {//I created 1 or more polls
                template["graph"] = "graph";
                template.polltitles = [];
                for (var i = 0; i < results.length; i++) {
                    template.polltitles.push({"question":results[i].question, "index":i, "selected":(i == 0),
                        "isactive":((i==0)?"is-active":""), "id":results[i].pollid
                    });
                }
            }
            template.polltypes = ["voting"]
        }
        //can't find the polls
        else if (results == null) {
            res.status(404).send("Poll not found");
            return;
        }
        //I am voting on the polls
        else {
            for (var poll of results) {
                template.polls = template.polls || [];
                var templatepoll = {
                    "question": poll.question,
                    "answers": [],
                    "id": poll.pollid
                }
                for (var i = 0; i < poll.answers.length; i++) {
                    templatepoll.answers.push({
                        "index": i + 1,
                        "value": poll.answers[i]
                    });
                }
                template.polls.push(templatepoll);
                template.polltitle = "Viewing someone else's poll";
            }

        }
        fs.readFile(path.join(__dirname, 'static/activity.html'), function response(err, html) {
            if (err) console.log(err);
            console.log(JSON.stringify(template));
            res.write(mustache.to_html(html.toString('utf-8'), template));
            res.end();
        });
    });
}

app.get('/activity/:userid', function(req, res, next) {
    passport.authenticate('bearer', {
        "session": "false"
    }, function(err, user, info) {
        if (err) {
            return next(err);
        }
        getActivity(req, res, next, user);
    })(req, res, next);
});

app.get('/', function(req, res, next) {
    passport.authenticate('bearer', {
        "session": "false"
    }, function(err, user, info) {
        if (err) {
            return next(err);
        }
        getIndex(req, res, next, user);
    })(req, res, next);
});


app.listen(PORT, function() {
    console.log("listening on port " + PORT);
});

var server = require('http').Server(app);
var io = require('socket.io')(server);
//socket.io -- TODO: Implement for live updates
//var io = require('socket.io').listen(app.server);
