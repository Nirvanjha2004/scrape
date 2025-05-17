import axios from 'axios';
import fs from 'fs/promises';

/**
 * Fetches free proxies from various sources and tests them
 */
async function collectWorkingProxies() {
  try {
    // Sources to collect proxies from
    const sources = [
      { 
        url: 'https://www.proxy-list.download/api/v1/get?type=http',
        parser: (data) => data.split('\r\n').filter(Boolean)
      },
      {
        url: 'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
        parser: (data) => data.split('\n').filter(Boolean)
      },
      {
        url: 'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
        parser: (data) => data.split('\n').filter(Boolean)
      },
      {
        url: 'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
        parser: (data) => data.split('\r\n').filter(Boolean)
      }
    ];

    // Collect all proxies
    let allProxies = [];
    
    for (const source of sources) {
      try {
        console.log(`Fetching proxies from: ${source.url}`);
        const response = await axios.get(source.url, { timeout: 10000 });
        const proxies = source.parser(response.data);
        console.log(`Found ${proxies.length} proxies from this source`);
        allProxies = [...allProxies, ...proxies];
      } catch (error) {
        console.error(`Error fetching from ${source.url}:`, error.message);
      }
    }
    
    // Remove duplicates
    allProxies = [...new Set(allProxies)];
    console.log(`Total unique proxies: ${allProxies.length}`);
    
    // Format all proxies with http:// prefix if they don't have it
    const formattedProxies = allProxies.map(proxy => {
      return proxy.includes('://') ? proxy : `http://${proxy}`;
    });
    
    // Test each proxy (limit concurrency to avoid overwhelming our connection)
    const MAX_CONCURRENT_TESTS = 10;
    const workingProxies = [];
    
    console.log('Testing proxies (this may take several minutes)...');
    
    // Test proxies in batches
    for (let i = 0; i < formattedProxies.length; i += MAX_CONCURRENT_TESTS) {
      const batch = formattedProxies.slice(i, i + MAX_CONCURRENT_TESTS);
      const tests = batch.map(async (proxy) => {
        const { testProxy } = await import('./proxyConfig.js');
        const isWorking = await testProxy(proxy);
        if (isWorking) {
          workingProxies.push(proxy);
          console.log(`Working proxy found: ${proxy}`);
        }
        return isWorking;
      });
      
      // Wait for this batch to complete
      await Promise.all(tests);
      console.log(`Tested ${i + batch.length}/${formattedProxies.length} proxies`);
    }
    
    console.log(`Found ${workingProxies.length} working proxies`);
    
    // Update our proxy config file
    const proxyListCode = `export const PROXY_LIST = [\n  '${workingProxies.join("',\n  '")}'${workingProxies.length > 0 ? "'" : ""}\n];`;
    
    await fs.writeFile('workingProxies.js', proxyListCode);
    console.log('Working proxies saved to workingProxies.js');
    
    return workingProxies;
  } catch (error) {
    console.error('Error collecting proxies:', error);
    return [];
  }
}

// Run the collector if executed directly
collectWorkingProxies().catch(console.error);
