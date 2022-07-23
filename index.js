console.log("Starting KEKL Track Data Downloader");

const axios = require('axios')
const { loginUbi, loginTrackmaniaUbi, getTrophyCount, getClubs, loginTrackmaniaNadeo, getClubCampaigns, getMaps, getMapRecords } = require('trackmania-api-node')

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

const getClubActivity = async (accessToken, clubId, offset = 0, length = 75) => {
    const headers = mySetHeaders(accessToken, 'nadeo');
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

const getCampaign = async (accessToken, clubId, campaignId) => {
    const headers = mySetHeaders(accessToken, 'nadeo');
    console.log("headers: ", headers)
    const response = await axios.default({
        url: 'https://live-services.trackmania.nadeo.live/api/token/club/' + clubId + '/campaign/' + campaignId,
        method: 'GET',
        headers,
    });
    return response['data'];
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
  //      const trophyCount = await getTrophyCount(accessToken, accountId)
    //    console.log(username + ' trophies:')
      //  console.log(trophyCount)
        const nadeoTokens = await loginTrackmaniaNadeo(accessToken, 'NadeoLiveServices')
//        console.log(nadeoTokens)
        const clubs = await getClubs(nadeoTokens.accessToken, accountId)
        console.log(clubs)
        var keklClubId = '43173';
        

        // 1. get all kekl campaigns in the club
        const activity = await getClubActivity(nadeoTokens.accessToken, keklClubId);
        console.log(activity)

        // 2. for each kekl campaign, list all the maps
        const keklCampaignId = '19280';        
        const room = await getCampaign(nadeoTokens.accessToken, keklClubId, keklCampaignId);
        console.log(room)


        // 3. for each campaign, pass the list of maps to get the map details
        const mapsDetail = await getMaps(accessToken, ['awiVZRLGq1xWL2IHIDWXRwA92ua'])
        console.log(mapsDetail)

        // 4. for each campaign, pass the list of maps to get the records (sleep 2 seconds between every request)
        const groupId = 'NLS-fklzHUzshGgUXObuuxR9fOp3DPrPyn1arvt';
        const mapId = '4usq4hgJTtIivBiFqc4UuPU3v8m';
        const mapRecords = await getMapRecordsFromTMIO(groupId, mapId)
        console.log(mapRecords)
        
        // 5. save output json


    } catch (e) {
        // axios error
        console.log(e)
    }
}




(async () => {
    console.log("Logging in...");
    const credentials = Buffer.from(process.env.TM_EMAIL + ':' + process.env.TM_PW).toString('base64')
    console.log("Got credentials");
    const loggedIn = await login(credentials)
    if (loggedIn) {
        try {

        await getTrackData(loggedIn)
        } catch (e) {
            console.log(e)
        }
        
    } else {
        console.log("Failed to log in, aborting")

    }
})()

console.log("Done")