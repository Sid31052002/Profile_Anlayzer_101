const { ApifyClient } = require('apify-client');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();
const { generateAltText } = require('./imageService');

const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN,
});

const ensurePublicDirectory = async () => {
    const publicDir = path.join(__dirname, '../public');
    try {
        await fs.access(publicDir);
    } catch {
        await fs.mkdir(publicDir, { recursive: true, mode: 0o755 });
    }
};

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
        const processedTweets = [];
        let textSummary = '';
        let imageCount = 0;

        // Process each tweet and its media
        for (let i = 0; i < items.length && imageCount < 10; i++) {
            const item = items[i];
            const tweetMedia = [];

            // Extract media URLs
            if (item.extended_entities?.media) {
                for (const media of item.extended_entities.media) {
                    if (media.media_url_https && imageCount < 10) {
                        mediaUrls.push(media.media_url_https);
                        const imageDescription = await generateAltText(media.media_url_https);
                        tweetMedia.push({
                            url: media.media_url_https,
                            description: imageDescription
                        });
                        imageCount++;
                    }
                }
            }

            const tweet = {
                text: item.full_text,
                media: tweetMedia
            };
            processedTweets.push(tweet);

            // Add to text summary
            textSummary += `Tweet ${i + 1}:\n`;
            textSummary += `Text: ${tweet.text}\n`;
            tweet.media.forEach((media, index) => {
                textSummary += `Image ${index + 1} URL: ${media.url}\n`;
                textSummary += `Description:\n${media.description}\n`;
            });
            textSummary += '----------------------------------------\n\n';
        }

        const profileId = profileUrl.split('/').pop();
        const jsonFilename = await saveImagesJson(mediaUrls, 'twitter', profileId);
        const textFileName = `twitter_summary_${Date.now()}.txt`;
        const publicDir = path.join(__dirname, '../public');
        await fs.writeFile(path.join(publicDir, textFileName), textSummary, 'utf8');

        const response = {
            tweets: processedTweets,
            success: true,
            datasetUrl: `https://console.apify.com/storage/datasets/${run.defaultDatasetId}`,
            mediaUrls,
            jsonFile: jsonFilename,
            textSummary: textFileName,
            textContent: textSummary
        };

        // Store response data before cleanup
        const responseData = { ...response };

        return responseData;
    } catch (error) {
        console.error('Error scraping profile:', error);
        return { success: false, error: error.message };
    }
    
    finally{
        // Clean up all files in public directory
        await cleanupPublicDirectory();
    }
};

// Add the flatten function
const flattenDict = (d, parentKey = "", sep = ".", arraySeparator = ", ") => {
    if (!d) return {};
    const items = [];
    for (const [k, v] of Object.entries(d)) {
        const newKey = parentKey ? `${parentKey}${sep}${k}` : k;
        if (v && typeof v === "object" && !Array.isArray(v)) {
            items.push(...Object.entries(flattenDict(v, newKey, sep, arraySeparator)));
        } else if (Array.isArray(v)) {
            const processedArray = v.map((item) =>
                item && typeof item === "object"
                    ? JSON.stringify(item, null, 2)
                    : String(item)
            );
            items.push([newKey, processedArray.join(arraySeparator)]);
        } else {
            items.push([newKey, v]);
        }
    }
    return Object.fromEntries(items);
};

const scrapeInstagramProfile = async (profileUrl) => {
    try {
        if (!profileUrl) {
            throw new Error("Instagram profile URL is required");
        }

        // Ensure public directory exists
        await ensurePublicDirectory();

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

        // Process posts with only required fields
        let textSummary = '';
        const processedPosts = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const imageDescription = await generateAltText(item.displayUrl);
            
            // Flatten the item object
            const flattenedItem = flattenDict(item);
            
            // Create post with flattened data
            const post = {
                username: flattenedItem['owner.username'] || 'N/A',
                fullName: flattenedItem['owner.fullName'] || 'N/A',
                caption: flattenedItem['text'] || 'No caption',
                alt: flattenedItem['alt'] || 'No alt text',
                image_url: flattenedItem['displayUrl'],
                description: imageDescription
            };

            processedPosts.push(post);

            // Add to text summary
            textSummary += `Post ${i + 1}:\n`;
            textSummary += `Username: ${post.username}\n`;
            textSummary += `Full Name: ${post.fullName}\n`;
            textSummary += `Caption: ${post.caption}\n`;
            textSummary += `Alt: ${post.alt}\n`;
            textSummary += `Image URL: ${post.image_url}\n`;
            textSummary += `Description:\n${post.description}\n`;
            textSummary += '----------------------------------------\n\n';
        }

        // Save text summary
        const textFileName = `instagram_summary_${Date.now()}.txt`;
        const publicDir = path.join(__dirname, '../public');
        await fs.writeFile(path.join(publicDir, textFileName), textSummary, 'utf8');

        const response = {
            textSummary: textFileName,
            textContent: textSummary
        };

        // Store response data before cleanup
        const responseData = { ...response };

        return responseData;
    } catch (error) {
        console.error('Error scraping profile:', error.message);
        throw new Error(error.response?.data || error.message);
    }
    finally {
        // Clean up all files in public directory
        await cleanupPublicDirectory();
    }
};

const cleanupPublicDirectory = async () => {
    const publicDir = path.join(__dirname, '../public');
    try {
        const files = await fs.readdir(publicDir);
        for (const file of files) {
            try {
                await fs.unlink(path.join(publicDir, file));
            } catch (error) {
                console.error(`Error deleting file ${file}:`, error);
            }
        }
    } catch (error) {
        console.error('Error cleaning public directory:', error);
    }
};

module.exports = { scrapeTwitterProfile, scrapeInstagramProfile, cleanupPublicDirectory };