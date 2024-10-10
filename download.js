const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Max depth to prevent infinite loops
const MAX_DEPTH = 5;

const visitedPages = new Set();

async function downloadPage(page, pageUrl, depth = 0) {
    if (depth > MAX_DEPTH || visitedPages.has(pageUrl)) {
        return;
    }
    
    visitedPages.add(pageUrl);
    console.log(`Downloading: ${pageUrl}`);
    
    await page.goto(pageUrl, { waitUntil: 'networkidle2' });
    
    // Get the page content
    const content = await page.content();

    // Save the page content to a local file
    const parsedUrl = url.parse(pageUrl);
    const filePath = path.join(__dirname, 'downloads', parsedUrl.hostname, parsedUrl.pathname, 'index.html');

    // Create the directory if it doesn't exist
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    
    // Write the HTML content to the file
    fs.writeFileSync(filePath, content, 'utf8');

    // Find all links on the page
    const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => a.href);
    });
    
    // Recursively download all the links
    for (const link of links) {
        const sameDomain = link.includes(parsedUrl.hostname);
        if (sameDomain) {
            await downloadPage(page, link, depth + 1);
        }
    }
}

// Function to download assets
async function downloadAssets(page) {
    page.on('response', async (response) => {
        const url = response.url();
        const resourceType = response.request().resourceType();

        // Download images, stylesheets, and scripts
        if (['image', 'stylesheet', 'script'].includes(resourceType)) {
            const buffer = await response.buffer();
            const parsedUrl = url.parse(url);
            const filePath = path.join(__dirname, 'downloads', parsedUrl.hostname, parsedUrl.pathname);

            // Create the directory if it doesn't exist
            fs.mkdirSync(path.dirname(filePath), { recursive: true });

            // Write the asset to the file
            fs.writeFileSync(filePath, buffer);
            console.log(`Downloaded asset: ${filePath}`);
        }
    });
}

(async () => {
    const browser = await puppeteer.launch({ headless: false }); // Set to true for headless
    const page = await browser.newPage();

    // Start the recursive download from the base URL
    const baseUrl = 'https://www.photopea.com';
    
    // Start downloading assets before visiting the page
    await downloadAssets(page);

    // Download the page
    await downloadPage(page, baseUrl);

    await browser.close();
})();
