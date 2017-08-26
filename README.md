# interactive-twitch

A new way for twitch broadcasters to interact with their viewers.  A simple voting app inspired by the [freeCodeCamp Voting App project](https://www.freecodecamp.org/challenges/build-a-voting-app)
but with the addition of integration with twitch chat. 

Twitch broadcasters can create polls that can be voted on in twitch chat or on the website.  This enables twitch broadcasters
to easily improve interactability with viewers.

## Usage

A live version of the app is currently on https://interactive-twitch.herokuapp.com

If you want to run this app yourself, you will need to create a twitch account.
Then, register an application at https://www.twitch.tv/kraken/oauth2/clients/new.
Make sure to set the redirect URI to your server url + '/auth/twitch/callback'
Go to https://twitchapps.com/tmi/ to generate a new OAUTH token.

Define the following variables in your environment:
SERVER_URL should be set to the url of your server, for example https://interactive-twitch.herokuapp.com/
MONGO_URL should be set to the url of your mongo database.
PORT should be set to the port that the application will listen to.
TWITCH_CLIENT_ID should be set to your application ID.
TWITCH_SECRET should be set to your application secret.
OAUTH_SECRET should be set to your OAUTH token.

## Install

With [npm](https://npmjs.org/) installed, and a mongo database running on MONGO_URL

```shell
npm install
node server.js
```

## License

MIT

## Authors

Eliot Glairon

## Acknowledgements

Thank you to [CodeBreak](https://codebreak.srnd.org/) for inspiring me to do this project.