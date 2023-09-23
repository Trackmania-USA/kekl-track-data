console.log("Starting KEKL Track Data Downloader");

const axios = require('axios')
const { loginUbi, loginTrackmaniaUbi, getTrophyCount, getClubs, loginTrackmaniaNadeo, getClubCampaigns, getMaps, getMapRecords } = require('trackmania-api-node')

var loggedIn;
var credentials;
var nadeoTokens;
var loginAttempts = 0;

var fs = require('fs');

const login = async credentials => {
    try {
        const { ticket } = await loginUbi(credentials) // login to ubi, level 0
        return await loginTrackmaniaUbi(ticket) // login to trackmania, level 1
    } catch (e) {
        // axios error
        console.log(e.toJSON())
    }
}
const myUrls = {
    auth: {
        ubisoft: 'https://public-ubiservices.ubi.com/v3/profiles/sessions',
        trackmaniaUbi: 'https://prod.trackmania.core.nadeo.online/v2/authentication/token/ubiservices',
        trackmaniaNadeo: 'https://prod.trackmania.core.nadeo.online/v2/authentication/token/nadeoservices',
        refreshToken: 'https://prod.trackmania.core.nadeo.online/v2/authentication/token/refresh',
    },
    prodTrackmania: 'https://prod.trackmania.core.nadeo.online',
    liveServices: 'https://live-services.trackmania.nadeo.live',
    matchmaking: 'https://matchmaking.trackmania.nadeo.club/api/matchmaking/2/',
};
const defaultHeaders = {
    'Content-Type': 'application/json',
    'Ubi-AppId': '86263886-327a-4328-ac69-527f0d20a237',
    'Ubi-RequestedPlatformType': 'uplay',
};

mySetHeaders = (auth, type) => type === 'basic'
    ? Object.assign(Object.assign({}, defaultHeaders), { Authorization: 'Basic ' + auth }) : type === 'ubi'
        ? Object.assign(Object.assign({}, defaultHeaders), { Authorization: 'ubi_v1 t=' + auth }) : type === 'nadeo' && Object.assign(Object.assign({}, defaultHeaders), { Authorization: 'nadeo_v1 t=' + auth });

const getClubActivity = async (clubId, offset = 0, length = 100) => {
    const headers = mySetHeaders(nadeoTokens.accessToken, 'nadeo');
    const response = await axios.default({
        url: myUrls.liveServices +
            '/api/token/club/' + clubId + '/activity?active=1&offset=' +
            offset +
            '&length=' +
            length,
        method: 'GET',
        headers,
    });

    var clubActivityData = response['data']

    const response2 = await axios.default({
        url: myUrls.liveServices +
            '/api/token/club/' + clubId + '/activity?active=1&offset=' +
            101 +
            '&length=' +
            length,
        method: 'GET',
        headers,
    });

    var clubActivityData2 = response2['data']

    clubActivityData.activityList = clubActivityData.activityList.concat(clubActivityData2.activityList)

    return clubActivityData;
};

const delay = ms => new Promise(res => setTimeout(res, ms));

const loginAgain = async () => {
   await delay(120000);

   loginAttempts = loginAttempts + 1;
   console.log("logging in again", loginAttempts);
   if (loginAttempts >= 3) {
        console.log("Logging in too many times")
        process.exit();
   }

  loggedIn = await login(credentials)
  const { accessToken, accountId, username } = loggedIn
  myAccessToken = accessToken;
  console.log("token", myAccessToken);
  nadeoTokens = await loginTrackmaniaNadeo(accessToken, 'NadeoLiveServices')
  console.log("nadeoTokens", nadeoTokens);
}

const getCampaign = async (clubId, campaignId) => {
    try {
      const headers = mySetHeaders(nadeoTokens.accessToken, 'nadeo');
      const response = await axios.default({
          url: 'https://live-services.trackmania.nadeo.live/api/token/club/' + clubId + '/campaign/' + campaignId,
          method: 'GET',
          headers,
      });

      return response['data'];
    } catch (error) {
        console.log("error", error);
        await loginAgain()
        return getCampaign(nadeoTokens.accessToken, clubId, campaignId)
    }
};

var retry = 0;
const getMapRecordsFromTMIO = async (groupId, mapId) => {
    try {
      const response = await axios.default({
          url: 'https://trackmania.io/api/leaderboard/' + groupId + '/' + mapId + '?offset=0&length=100',
          method: 'GET',
          headers: {
              'User-Agent': 'MattDTO KEKL Hunt'
          },
      });

        retry = 0;
        return response['data'];
     } catch (error) {
        retry = retry + 1;
        if (retry > 3) {
            process.exit()
        }
        return getMapRecordsFromTMIO(groupId, mapId);
     }
};

const getTrackData = async loggedIn => {
    const { accessToken, accountId, username } = loggedIn
    myAccessToken = accessToken;
    try {

        var data = {
            campaigns: [],
            activity: {}
        }

        //      const trophyCount = await getTrophyCount(accessToken, accountId)
        //    console.log(username + ' trophies:')
        //  console.log(trophyCount)
        nadeoTokens = await loginTrackmaniaNadeo(accessToken, 'NadeoLiveServices')
        //        console.log(nadeoTokens)


        //  const clubs = await getClubs(nadeoTokens.accessToken, accountId)
        //   console.log(clubs)
        var keklClubId = '43173';


        // 1. get all kekl campaigns in the club
        const activity = await getClubActivity(keklClubId);
        console.log("length of club activities:", activity.activityList.length)

        data.activity = activity;


        var camps = [];

        // list campaigns
        for (var item of activity.activityList) {
            if (item.activityType == "campaign" && item.name.includes("$g$z$o")) {
                console.log("Downloading data for campaign: ", item.campaignId);
                // 2. for each kekl campaign, list all the maps
                const keklCampaignId = item.campaignId;
                const campaign = await getCampaign(keklClubId, keklCampaignId);
                // fs.writeFile('campaign.json', JSON.stringify(campaign, null, 2), function (err) {
                //     if (err) throw err;
                // })

                var camp = {
                    detail: campaign,
                    mapsDetail: {},
                    mapsRecords: {},
                    groupId: ""
                }

                var mapUids = []
                for (var map of campaign.campaign.playlist) {
                    mapUids.push(map.mapUid)
                }

                console.log("Downloading maps for mapUids: ", mapUids);

                // 3. for each campaign, pass the list of maps to get the map details
                const mapsDetail = await getMaps(myAccessToken, mapUids)
                // fs.writeFile('mapsDetail.json', JSON.stringify(mapsDetail, null, 2), function (err) {
                //     if (err) throw err;
                // }) 
                camp.mapsDetail = mapsDetail;

                // 4. for each campaign, pass the list of maps to get the records (sleep 2 seconds between every request)
                camp.groupId = campaign.campaign.leaderboardGroupUid;
                camps.push(camp);
            }
        }
        for (var camp of camps) {
             for (var mapDet of camp.mapsDetail) {
                    console.log("Downloading records for map", mapDet.mapUid)

                    const mapRecords = await getMapRecordsFromTMIO(camp.groupId, mapDet.mapUid)
                    camp.mapsRecords[mapDet.mapUid] = mapRecords;

                    var waitTill = new Date(new Date().getTime() + 2000);
                    while (waitTill > new Date()) { }
             }

             data.campaigns.push(camp)
        }

        // 5. save output json
        fs.writeFile('data.json', JSON.stringify(data, null, 2), function (err) {
            if (err) throw err;
        })
    } catch (e) {
        // axios error
        console.log(e)
    }
}


(async () => {
    console.log("Logging in...");
    if (process.env.TM_PW && process.env.TM_PW.length > 0) {
        if (process.env.TM_EMAIL && process.env.TM_EMAIL.length > 0) {

            credentials = Buffer.from(process.env.TM_EMAIL + ':' + process.env.TM_PW).toString('base64')
            console.log("Got credentials");
            loggedIn = await login(credentials)
            if (loggedIn) {
                try {

                    await getTrackData(loggedIn)
                } catch (e) {
                    console.log(e)
                }

            } else {
                console.log("Failed to log in, aborting")

            }
        } else {
            console.log("TM_EMAIL must be set")
        }
    } else {
        console.log("TM_PW must be set")
    }

})()

console.log("Done")
