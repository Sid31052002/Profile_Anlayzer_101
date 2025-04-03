const { OpenAI } = require("openai");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const generateAltText = async (imagePathOrUrl, customPrompt) => {
  let imageData;
  if (imagePathOrUrl.startsWith("http")) {
    // Fetch remote image
    const response = await axios.get(imagePathOrUrl, { responseType: "arraybuffer" });
    imageData = Buffer.from(response.data).toString("base64");
    console.log(imageData,'??????????????????????????????????');
  } else {
    // Read local file
    imageData = await fs.readFile(imagePathOrUrl, { encoding: "base64" });
  }

  // Use the existing default prompt if no custom prompt provided
  const defaultPrompt = "Generate a very detailed description for the image given accurately.Specially Considering these points as seperate headings like *SUMMARY*,*LOCATION OF ELEMENTS*,*ADDITIONAL DETAILS*,*SPECULATION ABOUT WHAT IS IN THE PICTURE* .Focus more on the objects both at forefront and as well as background..";

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini", // Changed model name
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: customPrompt || defaultPrompt },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageData}` } },
        ],
      },
    ],
    max_tokens: 4096,
  });

  return response.choices[0].message.content;
};

const saveAltTextToFile = async (altText) => {
  const fileName = `alt_text_${Date.now()}.txt`;
  const filePath = path.join(__dirname, "../public", fileName);
  await fs.writeFile(filePath, altText, "utf8");
  return { fileName, filePath };
};

const analyzeImagesFromJson = async (jsonFileName) => {
  const publicDir = path.join(__dirname, '../public');
  const jsonFilePath = path.join(publicDir, jsonFileName);
  
  try {
    // Read the JSON file with image URLs
    const jsonContent = await fs.readFile(jsonFilePath, 'utf8');
    const imageUrls = JSON.parse(jsonContent);
    
    // Create object to store descriptions
    const descriptions = {};
    let markdownContent = '# Image Descriptions\n\n';
    
    // Analyze each image
    for (const [key, url] of Object.entries(imageUrls)) {
      try {
        const description = await generateAltText(url);
        descriptions[url] = description;
        
        // Add to markdown content
        markdownContent += `## Image ${key}\n`;
        markdownContent += `![Image ${key}](${url})\n\n`;
        markdownContent += `${description}\n\n`;
        markdownContent += '---\n\n';
      } catch (error) {
        console.error(`Error analyzing image ${key}:`, error);
        descriptions[url] = "Error analyzing image";
        
        // Add error to markdown
        markdownContent += `## Image ${key}\n`;
        markdownContent += `Error analyzing image\n\n`;
        markdownContent += '---\n\n';
      }
    }
    
    // Save descriptions to new JSON file
    const descriptionsFileName = `descriptions_${Date.now()}.json`;
    const descriptionsFilePath = path.join(publicDir, descriptionsFileName);
    await fs.writeFile(descriptionsFilePath, JSON.stringify(descriptions, null, 2));
    
    // Save markdown file
    const markdownFileName = `descriptions_${Date.now()}.md`;
    const markdownFilePath = path.join(publicDir, markdownFileName);
    await fs.writeFile(markdownFilePath, markdownContent);
    
    // Delete the original JSON file
    await fs.unlink(jsonFilePath);
    
    return {
      message: "Images analyzed successfully",
      descriptionsFile: descriptionsFileName,
      markdownFile: markdownFileName
    };
  } catch (error) {
    throw new Error(`Failed to analyze images: ${error.message}`);
  }
};

module.exports = { 
  generateAltText,
  saveAltTextToFile,
  analyzeImagesFromJson
};