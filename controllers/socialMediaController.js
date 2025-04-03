const { scrapeTwitterProfile, scrapeInstagramProfile } = require('../services/socialMediaService');
const { analyzeImagesFromJson } = require('../services/imageService');

const getTwitterMedia = async (req, res) => {
    const { profileUrl, sinceDate, resultCount } = req.query;

    if (!profileUrl) {
        return res.status(400).json({ success: false, error: "Profile URL is required" });
    }

    const result = await scrapeTwitterProfile(profileUrl, sinceDate, resultCount);
    res.json(result);
};

const getInstagramPosts = async (req, res) => {
    try {
        const { profileUrl } = req.query;
        if (!profileUrl) {
            return res.status(400).json({ success: false, error: "Missing profileUrl parameter" });
        }

        const data = await scrapeInstagramProfile(profileUrl);
        res.json({ success: true, ...data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const analyzeImages = async (req, res) => {
    try {
        const { jsonFile } = req.body;
        if (!jsonFile) {
            return res.status(400).json({ success: false, error: "JSON file name is required" });
        }

        const result = await analyzeImagesFromJson(jsonFile);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const processProfileUrl = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ success: false, error: "URL is required" });
        }

        let scrapingResult;
        if (url.includes('twitter.com') || url.includes('x.com')) {
            scrapingResult = await scrapeTwitterProfile(url);
        } else if (url.includes('instagram.com')) {
            scrapingResult = await scrapeInstagramProfile(url);
        } else {
            return res.status(400).json({ success: false, error: "Invalid social media URL" });
        }

        res.json({
            success: true,
            data: {
                posts: scrapingResult.posts,
                textContent: scrapingResult.textContent
            }
        });
    } catch (error) {
        console.error('Error processing URL:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = { getTwitterMedia, getInstagramPosts, analyzeImages, processProfileUrl };