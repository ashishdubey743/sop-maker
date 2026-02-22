const { SitemapStream, streamToPromise } = require('sitemap');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const baseUrl = process.env.BASE_URL;

async function generateSitemap() {
    try {
        const smStream = new SitemapStream({ hostname: baseUrl });
        smStream.write({
            url: '/',
            changefreq: 'daily',
            priority: 1.0
        });

        smStream.write({
            url: '/login.html',
            changefreq: 'monthly',
            priority: 0.5
        });
        
        smStream.end();

        const sitemapXml = await streamToPromise(smStream);

        const sitemapPath = path.join(__dirname, 'public', 'sitemap.xml');

        await fs.writeFile(sitemapPath, sitemapXml.toString());

        console.log('Sitemap generated successfully!');
        console.log('Location:', sitemapPath);

    } catch (error) {
        console.error('Error generating sitemap:', error);
    }
}

generateSitemap();