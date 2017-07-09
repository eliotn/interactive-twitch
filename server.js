//TODO: figure out why there seems to be a double execute sometime with twitch
//passport

const SERVER = process.env.SERVER_URL || "https://test-eliotn.c9users.io";
const PORT = process.env.PORT || 3000;
const DROP_DATA = false;
const MONGO_URL = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/twitchvotes';
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const OAUTH_SECRET = process.env.OAUTH_SECRET;
const TWITCH_SECRET = process.env.TWITCH_SECRET;

//express
const express = require('express');
const app = express();

//setup file server
const path = require('path');


var MongoClient = require('mongodb').MongoClient;

//allow JSON request bodies to be readable
const bodyParser = require('body-parser');
app.use(bodyParser.json());

//users contains the following
//access_token, userid, tokenUpdateTime
//polls contains the following
//userid, question, [answer], [votes]
var users; //get the collection
var polls; //get the polls
MongoClient.connect(MONGO_URL, function(err, database) {
    if (err) throw err;
    users = database.collection('users');
    polls = database.collection('polls');
    if (DROP_DATA) { //utility function to retest with new data
        users.drop();
        polls.drop();
        //tokens have a lifetime of 2400 seconds (60 minutes)
        users.createIndex({
            "tokenUpdateTime": 1
        }, {
            "expireAfterSeconds": 2400
        });
    }
});

function deletePoll(pollid) {
    var returnval = {};
    polls.findOneAndDelete({
        "userid": Number(pollid)
    }, function(err, res) {
        if (err) returnval = {
            "err": err
        };
        else {
            if (res) {
                returnval = {};
            }
            returnval = {
                "err": "resource not found"
            };
        }
    });
    return returnval;
}


//adds vote, requires number pollid and vote option
function addVote(pollid, vote, user) {
    console.log("Starting vote!");
    console.log(pollid);
    console.log(vote);
    var result_json = {};
    polls.findOne({
        "userid": Number(pollid)
    }, {}, function(err, results) {
        if (err) {
            result_json = {
                "err": err
            };
            return;
        }

        if (!results || vote < 0 || results.answers.length - 1 < vote) {
            result_json = {
                "err": "Poll not found"
            };
            return;
        }
        if (results.usersvoted.indexOf(Number(user)) != -1) {
            result_json = {
                "err": "You already voted"
            };
            return;
        }
        polls.updateOne({
            "userid": Number(pollid)
        }, {
            $inc: {
                ["votes." + String(vote)]: 1
            }
        }, function(err, results) {
            if (err) {
                result_json = {
                    "err": err
                };
            }
            else {
                result_json = {
                    "Note:": "vote counted"
                }
            };
            if (user && !("err" in result_json)) {
                polls.updateOne({
                    "userid": Number(pollid)
                }, {
                    $push: {
                        "usersvoted": Number(user)
                    }
                });
            }
        });


    });
    return result_json;
}

//creates a poll
function createPoll(pollid, question, answerlist) {
    var result_json = {};
    polls.findOne({
        "userid": Number(pollid)
    }, {}, function(err, results) {
        if (err) {
            result_json = {
                "err": err
            };
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
            polls.insert({
                "usersvoted": [],
                "userid": Number(pollid),
                "question": question,
                "answers": answers,
                "votes": votes
            }, function(err) {
                if (err) result_json = {
                    "err": err
                };
                else result_json = {
                    "Note": "Poll added"
                };
            });
        }
        else {
            console.log("update poll with new information");
            polls.updateOne({
                "userid": Number(pollid)
            }, {
                $set: {
                    "question": question,
                    "answers": answers,
                    "votes": votes
                }
            });
            result_json = {
                "Note": "Poll updated"
            };
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
    channels: []
});
client.connect();
client.on("chat", function(channel, userstate, message, self) {
    console.log(message);
    var number = /[1-9][0-9]*/;
    var match = number.exec(message);
    if (match) {
        addVote(channelToID[channel], Number(match) - 1, userstate["user-id"]);
    }


});
//only seems to work when joining a channel in the channels list
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
            function(err, request, body) {
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
    callbackURL: SERVER + "/auth/twitch/callback",
    scope: "user_read",
    session: false
}, function(accessToken, refreshToken, profile, done) {
    //do stuff with the user after you log them in
    users.findOne({
        "userid": profile.id
    }, function(err, results) {
        if (err) {
            return done(err);
        }
        if (!results) {
            console.log("user needs to be created");
            console.log(profile);
            users.insert({
                "userid": profile.id,
                "username": profile.displayName,
                "access_token": accessToken,
                "tokenUpdateTime": new Date()
            }, function(err) {
                if (err) return done(err);
                return done(null, {
                    "userid": profile.id,
                    "access_token": accessToken
                });
            });
        }
        else {
            console.log("user already logged in!");
            users.updateOne({
                "userid": profile.id
            }, {
                $set: {
                    "username": profile.displayName,
                    "access_token": accessToken,
                    "tokenUpdateTime": new Date()
                }
            });
            return done(null, {
                "userid": profile.id,
                "access_token": accessToken
            });
        }
    });
    console.log(JSON.stringify(profile));
    //put data we want access to in the callback here

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
            users.findOne({
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

//session is set to false because we aren't using sessions
//thanks https://jeroenpelgrims.com/token-based-sessionless-auth-using-express-and-passport
app.get('/auth/twitch/', passport.authenticate("twitch", {
    session: false
}));
app.get('/auth/twitch/callback', passport.authenticate("twitch", {
    session: false,
    failureRedirect: '/'
}), function(req, res) {

    res.redirect('/activity/' + req.user.userid + '?access_token=' + req.user.access_token);
});
app.get('/auth/logout', passport.authenticate("bearer", {
    session: false,
    failureRedirect: '/'
}), function(req, res) {
    users.updateOne({
        "access_token": req.user.access_token
    }, {
        $set: {
            "access_token": 0
        }
    });
    res.redirect('/');
});
app.put('/api/vote/:pollid/:vote', function(req, res) {
    var voteresult = addVote(Number(req.params.pollid), req.params.vote - 1);
    if ("err" in voteresult) {
        res.status(404).send();
        return;
    }
    res.json(voteresult)
});
app.get('/api/poll', passport.authenticate("bearer", {
    session: false
}), function(req, res) {
    polls.findOne({
        "userid": req.user.userid
    }, {}, function(err, results) {
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
        var object = {
            "question": results.question,
            "answers": results.answers,
            "votes": results.votes
        };
        res.json(object);
        return;
    });
});
app.post('/api/poll', passport.authenticate("bearer", {
    session: false
}), function(req, res) {
    console.log(req.body);
    if (req.body.question && req.body.answers) {
        client.join("#" + req.user.username);

        res.json(createPoll(Number(req.user.userid), req.body.question, req.body.answers));
        channelToID["#" + req.user.username] = req.user.userid;
        client.say("#" + req.user.username, "Poll has been created with question '" + req.body.question + "'");
    }

    else {
        res.json({
            "Note": "You posted an invalid poll"
        });
    }
});

app.delete('/api/poll', passport.authenticate("bearer", {
    session: false
}), function(req, res) {
    var delete_status = deletePoll(req.user.userid);
    if ("err" in delete_status) {
        res.status(204).send(delete_status.err);
    }
    client.say("#" + req.user.username, "The poll is over!");
    client.part('#' + req.user.username);
    res.status(204).send("Deleted");
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

    app.get('/api/debug/users', passport.authenticate("bearer", {
        session: false
    }), function(req, res) {
        users.find().toArray(function(err, result) {
            if (err) throw err;
            res.json({
                'users': JSON.stringify(result)
            });
        });
    });

    app.get('/api/debug/polls', passport.authenticate("bearer", {
        session: false
    }), function(req, res) {
        polls.find().toArray(function(err, result) {
            if (err) throw err;
            res.json({
                'polls': JSON.stringify(result)
            });
        });
    });
}
//app.use(express.static(path.join(__dirname, 'static/css')));
//app.use(express.static(path.join(__dirname, 'static/js')));

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

//http templating
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
            for (var i = 0; i < result.length; i++) {
                template.polls.push(result[i].userid);
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
    if (user) {
        template.user = user.username;
    }
    polls.findOne({
        "userid": Number(req.params.userid)
    }, {}, function(err, results) {
        if (err) console.log(err);
        var answers = [];
        if (user && user.userid == req.params.userid) {
            if (results) {
                template["graph"] = "graph";
                template.polltitle = results.question;
            }
            template.polltypes = ["voting"]
        }
        else if (results == null) {
            res.status(404).send("Poll not found");
            return;
        }
        else {
            template.question = results.question;

            for (var i = 0; i < results.answers.length; i++) {
                answers.push({
                    "index": i + 1,
                    "value": results.answers[i]
                })
            }
            template.answers = answers;
            template.polltitle = "Viewing someone else's poll";

        }
        fs.readFile(path.join(__dirname, 'static/activity.html'), function response(err, html) {
            if (err) console.log(err);
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
