const express = require('express');
const dotenv = require('dotenv');
const socialMediaRoutes = require('./routes/socialMediaRoutes');

dotenv.config();
const app = express();

app.use(express.json());
app.use('/api', socialMediaRoutes);

// Update port configuration
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;

