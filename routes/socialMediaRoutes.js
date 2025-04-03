const express = require('express');
const { getTwitterMedia, getInstagramPosts, analyzeImages, processProfileUrl } = require('../controllers/socialMediaController');

const router = express.Router();

router.post('/process', processProfileUrl); // New endpoint
router.get('/twitter/scrape', getTwitterMedia);
router.get('/instagram/scrape', getInstagramPosts);
router.post('/analyze/images', analyzeImages);

module.exports = router;