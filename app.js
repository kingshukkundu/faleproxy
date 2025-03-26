const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware to parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to fetch and modify content
app.post('/fetch', async (req, res) => {
  try {
    let { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Automatically add https:// if protocol is missing
    if (!url.match(/^https?:\/\//i)) {
      url = 'https://' + url;
    }

    // Fetch the content from the provided URL
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const html = response.data;

    // Use cheerio to parse HTML and selectively replace text content, not URLs
    const $ = cheerio.load(html, {
      decodeEntities: false,  // Preserve original entities
      xmlMode: false,         // Handle as HTML
      normalizeWhitespace: false // Preserve whitespace
    });
    
    // Fix base URL for resources
    let baseUrl = url;
    const baseTag = $('base');
    if (baseTag.length && baseTag.attr('href')) {
      baseUrl = baseTag.attr('href');
    } else {
      // Add base tag to ensure relative URLs work correctly
      $('head').prepend(`<base href="${url}">`); 
    }
    
    // Fix relative URLs in various attributes
    const urlAttributes = ['src', 'href', 'action', 'data-src'];
    urlAttributes.forEach(attr => {
      $(`[${attr}]`).each(function() {
        const attrValue = $(this).attr(attr);
        if (attrValue && !attrValue.startsWith('http') && !attrValue.startsWith('//') && !attrValue.startsWith('#') && !attrValue.startsWith('javascript:') && !attrValue.startsWith('data:')) {
          $(this).attr(attr, new URL(attrValue, url).href);
        }
      });
    });
    
    // Process text nodes in the body to replace Yale with Fale
    function processNode(index, element) {
      // Skip script and style tags
      if (element.name === 'script' || element.name === 'style') {
        return;
      }
      
      // Process text nodes
      $(element).contents().each(function() {
        if (this.type === 'text') {
          const text = $(this).text();
          const newText = text
            .replace(/Yale/g, 'Fale')
            .replace(/YALE/g, 'FALE')
            .replace(/yale/g, 'fale');
          if (text !== newText) {
            $(this).replaceWith(newText);
          }
        } else if (this.type === 'tag') {
          // Recursively process child elements
          processNode(0, this);
        }
      });
    }
    
    // Process all elements
    $('*').each(processNode);
    
    // Process title separately
    const title = $('title').text()
      .replace(/Yale/g, 'Fale')
      .replace(/YALE/g, 'FALE')
      .replace(/yale/g, 'fale');
    $('title').text(title);
    
    // Add CSS to fix iframe rendering issues
    $('head').append(`
      <style>
        img, video, iframe { max-width: 100%; height: auto; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      </style>
    `);
    
    return res.json({ 
      success: true, 
      content: $.html(),
      title: title,
      originalUrl: url
    });
  } catch (error) {
    console.error('Error fetching URL:', error.message);
    return res.status(500).json({ 
      error: `Failed to fetch content: ${error.message}` 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Faleproxy server running at http://localhost:${PORT}`);
});
