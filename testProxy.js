import { getNextProxy, formatProxyForAxios, testProxy } from './proxyConfig.js';
import axios from 'axios';

/**
 * Test a specific proxy provided in command line arguments
 * or test all proxies in the configuration file
 */
async function main() {
  // Check if a specific proxy was provided as command line argument
  const specificProxy = process.argv[2];
  
  if (specificProxy) {
    console.log(`Testing specific proxy: ${specificProxy}`);
    const isWorking = await testProxy(specificProxy);
    
    console.log(`\nTest result for ${specificProxy}:`);
    console.log(`Working: ${isWorking ? '✅ YES' : '❌ NO'}`);
    
    if (isWorking) {
      try {
        // Try to make a request to LinkedIn through this proxy
        console.log('\nTesting proxy with LinkedIn...');
        const formattedProxy = formatProxyForAxios(specificProxy);
        
        const response = await axios.get('https://www.linkedin.com/robots.txt', {
          proxy: formattedProxy,
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        
        console.log(`LinkedIn test: ✅ SUCCESS (Status: ${response.status})`);
        console.log(`This proxy works well with LinkedIn!`);
      } catch (error) {
        console.log(`LinkedIn test: ❌ FAILED`);
        console.log(`Error: ${error.message}`);
        console.log(`This proxy might be blocked by LinkedIn or have other issues.`);
      }
    }
  } else {
    // Test all proxies in the configuration
    console.log('Testing all proxies in configuration...');
    
    // Import the proxies directly from proxyConfig
    const { PROXY_LIST } = await import('./proxyConfig.js');
    
    if (!PROXY_LIST || PROXY_LIST.length === 0) {
      console.log('No proxies found in configuration.');
      return;
    }
    
    console.log(`Found ${PROXY_LIST.length} proxies to test.`);
    
    // Track working proxies
    const workingProxies = [];
    
    // Test each proxy
    for (let i = 0; i < PROXY_LIST.length; i++) {
      const proxy = PROXY_LIST[i];
      process.stdout.write(`Testing proxy ${i+1}/${PROXY_LIST.length}: ${proxy}... `);
      
      const isWorking = await testProxy(proxy);
      
      process.stdout.write(isWorking ? '✅ WORKING\n' : '❌ FAILED\n');
      
      if (isWorking) {
        workingProxies.push(proxy);
      }
      
      // Add a small delay between tests to avoid overwhelming the network
      if (i < PROXY_LIST.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`\nTEST RESULTS:`);
    console.log(`Total proxies: ${PROXY_LIST.length}`);
    console.log(`Working proxies: ${workingProxies.length}`);
    console.log(`Success rate: ${Math.round((workingProxies.length / PROXY_LIST.length) * 100)}%`);
    
    if (workingProxies.length > 0) {
      console.log(`\nWorking proxies:`);
      workingProxies.forEach(proxy => console.log(`- ${proxy}`));
    } else {
      console.log('\nNo working proxies found. Please update your proxy list.');
    }
  }
}

main().catch(error => {
  console.error('Error in proxy testing:', error);
  process.exit(1);
});
