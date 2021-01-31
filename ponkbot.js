//required node modules
var Twit = require('twit');
const fetch = require('node-fetch');
const dinky = require('dinky.js');
const nodeCron = require('cron');


function initialiseTwit() {
    return new Twit({
        consumer_key: process.env.consumer_key,
        consumer_secret: process.env.consumer_secret,
        access_token: process.env.access_token,
        access_token_secret: process.env.access_token_secret
    });
}

function getImageRandom() {
    const tagList = ["pinkie pie", "safe", "solo", "!webm", "score.gte:50", "!irl human"];
    return dinky({filter: 167482}).search(tagList).random().limit(1);
}

function getImageSpecific(id) {
    return dinky({filter: 167482}).getById(id);
}

function fetchImage(urlDirect, status) {
    fetch(urlDirect)
    .then(res => res.buffer())
    .then(buffer => postTweetWithImage(buffer.toString('base64'), status))
    .catch(error => console.error(error))
} 

function getArtists(tagsArray) {
    const tags = tagsArray.toString();
    if (tags.includes("artist:")) {
        const numOfArtists = tags.match(new RegExp("artist:", "g") || []).length;
        const pattern = /artist:./;
        const arrOfTags = tags.split(",");
        let tagsStripped = [];
        let a = 0;
        for (i = 0; i < arrOfTags.length; i++) {
            if (numOfArtists == a) {
                const artistsString = tagsStripped.join(", ");
                return artistsString;
            }
            let tag = arrOfTags[i].trim();
            if (pattern.test(tag)) {
                let tagStripped = tag.substring(7);
                if (numOfArtists > 1) {
                    tagsStripped[a] = tagStripped;
                    a++;
                } else {
                    return tagStripped;
                }
            }
        }
    }
    return null;
}

function createStatus(id, artists, sauce) {
    let artistText = '';
    let sauceText = '';
    const url = "Derpi link: https://derpibooru.org/" + id;
    if (artists != null) {
        if (artists.includes(',')) {
            artistText = "Artists: " + artists + " | ";
        }
        else {
            artistText = "Artist: " + artists + " | ";
        }
    }
    if (sauce != null) {
        if (sauce.includes("http")) {
            sauceText = "Source: " + sauce + " | ";
        }
    }
    return artistText + sauceText + url;
}

function postTweetWithImage(image, status) {
    const T = initialiseTwit();
    if (Buffer.byteLength(image) < 5000000) {
        T.post('media/upload', { media_data: image }, function (err, data, response) {
            var mediaIdStr = data.media_id_string
            var meta_params = { media_id: mediaIdStr, alt_text: { text: "Pinkie Pie" } }
            T.post('media/metadata/create', meta_params, function (err, data, response) {
            if (!err) {
                var params = { status: status, media_ids: [mediaIdStr] }
                T.post('statuses/update', params, function (err, data, response) {});
            }
            else {
                console.log(err);
            }
            });
        });
    }
    else {
        T.post('statuses/update', { status: status }, function(err, data, response) {})
    }
}

function checkSource(res, sauce) {
    if (sauce.includes("https://twitter.com")) {
        if (res.ok) {
            const twitterPattern = /status\/([0-9]+)/
            const matchedTwitterPattern = twitterPattern.exec(sauce)
            retweetImage(matchedTwitterPattern[1]);
            return false;
        }
    }
    return true;
}

function retweetImage(twitterID) {
    const T = initialiseTwit();
    T.post('statuses/unretweet/:id', {id: twitterID}, function (err, data, response) {
        T.post('statuses/retweet/:id', {id: twitterID}, function (err, data, response) {})
    })
}

function post(tagsArray, id, sauce, urlDirect) {
    const artists = getArtists(tagsArray);
    const status = createStatus(id, artists, sauce);
    fetchImage(urlDirect, status);
}

function getRandomFollower() {
    const T = initialiseTwit();
    T.get('followers/ids', { screen_name: 'Ponkbot1' }, function (err, data, response) {
        const followers = data.ids;
        const randNum = Math.floor(Math.random() * followers.length);
        let randFollowerID = followers[randNum];
        T.get('users/show', { user_id: randFollowerID }, function (err, data, response) {
            let userName = data.screen_name;
            return '.@' + userName;
        })
    });
}

//main
nodeCron.job(
    '0 0,30 * * * *',
    function() {
        dateObj = new Date()
        if (dateObj.getDay() == 0 && dateObj.getHours() == 12 && dateObj.getMinutes() == 0) {
            fetchImage("https://derpicdn.net/img/view/2016/2/15/1089039.gif", getRandomFollower());
        } else {
            getImageRandom().then(({images}) => {
                const result = images[0]
                const urlDirect = result["viewUrl"];
                const id = result["id"];
                const tagsArray = result["tags"];
                const sauce = result["sourceUrl"];

                if (sauce == null || sauce == '') {
                    post(tagsArray, id, sauce, urlDirect)
                }
                else {
                    fetch(sauce).then(res => {
                        const notRetweetable = checkSource(res, sauce);
                        if (notRetweetable) {
                            post(tagsArray, id, sauce, urlDirect);
                        }
                    }).catch((error) => {
                        console.log(error);
                        post(tagsArray, id, sauce, urlDirect);
                    });
                }
            })
            .catch(error => console.log(error));
        }
    },
    null,
    true
)
