const { SitemapStream, streamToPromise } = require('sitemap');
const fs = require('fs').promises;
const path = require('path');

// Base URL from your project
const baseUrl = 'https://sop-maker.pxxl.click';

async function generateSitemap() {
    try {
        // Create a sitemap stream
        const smStream = new SitemapStream({ hostname: baseUrl });
        
        // Add pages to sitemap
        smStream.write({ url: '/login.html', changefreq: 'daily', priority: 0.8 });
        smStream.write({ url: '/index.html', changefreq: 'daily', priority: 0.8 });
        
        // Add static assets
        smStream.write({ url: '/css/style.css', changefreq: 'weekly', priority: 0.3 });
        smStream.write({ url: '/js/chatbot.js', changefreq: 'weekly', priority: 0.3 });
        smStream.write({ url: '/favicon.ico', changefreq: 'weekly', priority: 0.3 });
        
        smStream.end();
        
        // Convert stream to string
        const sitemapXml = await streamToPromise(smStream);
        
        // Save sitemap to file
        await fs.writeFile('public/sitemap.xml', sitemapXml);

        console.log('🎊 Sitemap generated successfully!');
        console.log('📁 Location: public/sitemap.xml');
        
    } catch (error) {
        console.error('❌ Error generating sitemap:', error);
    }
}

// Run the sitemap generator
generateSitemap();