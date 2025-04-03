const { ApifyClient } = require('apify-client');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

const saveImagesJson = async (images, platform, profileId) => {
    const publicDir = path.join(__dirname, '../public');
    try {
        await fs.mkdir(publicDir, { recursive: true });
        
        const imageMap = {};
        images.forEach((url, index) => {
            imageMap[index + 1] = url;
        });

        const filename = `${platform}_${profileId}_${Date.now()}.json`;
        await fs.writeFile(
            path.join(publicDir, filename),
            JSON.stringify(imageMap, null, 2)
        );
        return filename;
    } catch (error) {
        console.error('Error saving images JSON:', error);
        throw error;
    }
};

const scrapeTwitterProfile = async (profileUrl, sinceDate = "2024-03-05", resultCount = "50") => {
    try {
        console.log(`🚀 Scraping Twitter profile: ${profileUrl}`);
        
        const input = {
            "start_urls": [{ "url": profileUrl }],
            "since_date": sinceDate,
            "result_count": String(resultCount),
            "include_replies": true,
            "include_retweets": true,
            "expand_tweet": true,
            "include_media": true,
            "tweet_mode": "extended"
        };

        const run = await client.actor("gentle_cloud/twitter-tweets-scraper").call(input);
        console.log(` Check your data here: https://console.apify.com/storage/datasets/${run.defaultDatasetId}`);

        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        const mediaUrls = [];
        items.forEach((item) => {
            if (item.extended_entities && item.extended_entities.media) {
                item.extended_entities.media.forEach(media => {
                    if (media.media_url_https) {
                        mediaUrls.push(media.media_url_https);
                    }
                });
            } else if (item.entities && item.entities.media) {
                item.entities.media.forEach(media => {
                    if (media.media_url_https) {
                        mediaUrls.push(media.media_url_https);
                    }
                });
            }
        });
        
        const profileId = profileUrl.split('/').pop();
        const jsonFilename = await saveImagesJson(mediaUrls, 'twitter', profileId);

        return {    
            tweets: items.map((tweet) => ({text: tweet.full_text})),
            success: true, 
            datasetUrl: `https://console.apify.com/storage/datasets/${run.defaultDatasetId}`,
            mediaUrls,
            jsonFile: jsonFilename 
        };
    } catch (error) {
        console.error('Error scraping profile:', error);
        return { success: false, error: error.message };
    }
};

const scrapeInstagramProfile = async (profileUrl) => {
    try {
        if (!profileUrl) {
            throw new Error("Instagram profile URL is required");
        }

        console.log(`🚀 Scraping Instagram profile: ${profileUrl}`);

        const input = {
            directUrls: [profileUrl],
            resultsLimit: 10,
            searchType: "user",
            resultsType: "posts"
        };

        const run = await client.actor('apify/instagram-scraper').call(input);
        console.log(`Data stored at: https://console.apify.com/storage/datasets/${run.defaultDatasetId}`);

        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        console.log('========= Instagram Scraping Results =========');
        console.log('Number of items found:', items.length);
        items.forEach((item, index) => {
            console.log(`\nPost ${index + 1}:`);
            console.log('Display URL:', item.displayUrl);
            console.log('Caption:', item.text);
            console.log('Likes:', item.likesCount);
            console.log('Comments:', item.commentsCount);
            console.log('Timestamp:', item.timestamp);
            console.log('----------------------------------------');
        });

        const imageUrls = items.map(item => item.displayUrl);
        const profileId = profileUrl.split('/').pop();
        const jsonFilename = await saveImagesJson(imageUrls, 'instagram', profileId);

        return {
            datasetUrl: `https://console.apify.com/storage/datasets/${run.defaultDatasetId}`,
            posts: items.map((item, index) => ({
                index: index + 1,
                imageUrl: item.displayUrl,
            })),
            jsonFile: jsonFilename
        };
    } catch (error) {
        console.error('Error scraping profile:', error.message);
        throw new Error(error.response?.data || error.message);
    }
};

module.exports = { scrapeTwitterProfile, scrapeInstagramProfile };