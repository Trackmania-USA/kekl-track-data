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

const getClubActivity = async (clubId, offset = 0, length = 75) => {
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
    return response['data'];
};


const loginAgain = async () => {

   loginAttempts = loginAttempts + 1;
   console.log("logging in again", loginAttempts);
   if (loginAttempts >= 3) {
        console.log("Logging in too many times")
        process.exit();
   }

  loggedIn = await login(credentials)
  const { accessToken, accountId, username } = loggedIn
  nadeoTokens = await loginTrackmaniaNadeo(accessToken, 'NadeoLiveServices')
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
        await loginAgain()
        return getCampaign(accessToken, clubId, campaignId)
    }
};

const getMapRecordsFromTMIO = async (groupId, mapId) => {
      const response = await axios.default({
          url: 'https://trackmania.io/api/leaderboard/' + groupId + '/' + mapId + '?offset=0&length=100',
          method: 'GET',
          headers: {
              'User-Agent': 'MattDTO KEKL Hunt'
          },
      });

    return response['data'];
};

const getTrackData = async loggedIn => {
    const { accessToken, accountId, username } = loggedIn
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
        // fs.writeFile('activity.json', JSON.stringify(activity, null, 2), function (err) {
        //     if (err) throw err;
        // })

        data.activity = activity;

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
                    mapsRecords: {}
                }

                var mapUids = []
                for (var map of campaign.campaign.playlist) {
                    mapUids.push(map.mapUid)
                }


                // 3. for each campaign, pass the list of maps to get the map details
                const mapsDetail = await getMaps(accessToken, mapUids)
                // fs.writeFile('mapsDetail.json', JSON.stringify(mapsDetail, null, 2), function (err) {
                //     if (err) throw err;
                // }) 
                camp.mapsDetail = mapsDetail;

                // 4. for each campaign, pass the list of maps to get the records (sleep 2 seconds between every request)
                const groupId = campaign.campaign.leaderboardGroupUid;

                for (var mapDet of mapsDetail) {
                    console.log("Downloading records for map", mapDet.mapUid)

                    const mapRecords = await getMapRecordsFromTMIO(groupId, mapDet.mapUid)
                    camp.mapsRecords[mapDet.mapUid] = mapRecords;

                    var waitTill = new Date(new Date().getTime() + 2000);
                    while (waitTill > new Date()) { }
                }

                data.campaigns.push(camp)
            }
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