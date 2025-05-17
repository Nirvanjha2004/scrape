import axios from "axios";
import express from "express";
import { getNextProxy, formatProxyForAxios, testProxy } from './proxyConfig.js';
const app = express();
const port = 3000;
import { getCookies } from "./getcookies.js";

// Add middleware to parse JSON request bodies
app.use(express.json());

// Change to POST route since we're receiving data in the request body
app.post("/", async (req, res) => {
  const { searchUrl, cookies } = req.body;

  console.log(searchUrl, cookies);
  if (!searchUrl) {
    return res.status(400).send("Search URL is required");
  }
  if (!cookies) {
    return res.status(400).send("LinkedIn cookies are required");
  }


  /**
   * Extracts CSRF token from LinkedIn cookies
   */
  function extractCsrfToken(cookies) {
    // Fix the JSESSIONID regex to only capture the actual token
    const jsessionidPattern = /JSESSIONID=(?:")?ajax:([^";]+)(?:")?/;
    const jsessionidMatch = cookies.match(jsessionidPattern);
    
    // It can also be in the csrf-token cookie
    const csrfMatch = cookies.match(/csrf-token=([^;]+)/);
    
    let token = null;
    
    if (jsessionidMatch && jsessionidMatch[1]) {
      token = `ajax:${jsessionidMatch[1]}`;
      console.log(`Found CSRF token from JSESSIONID: ${token}`);
    } else if (csrfMatch && csrfMatch[1]) {
      token = csrfMatch[1];
      console.log(`Found CSRF token from csrf-token: ${token}`);
    }
    
    return token;
  }

  /**
   * Validates that cookies contain the necessary authentication tokens
   */
  function validateCookies(cookies) {
    const requiredCookies = ['li_at'];
    const recommendedCookies = ['JSESSIONID', 'bcookie', 'bscookie', 'lidc'];
    
    // Check for required cookies
    const missingRequired = requiredCookies.filter(name => !cookies.includes(`${name}=`));
    if (missingRequired.length > 0) {
      console.warn(`Missing required cookies: ${missingRequired.join(', ')}`);
      return false;
    }
    
    // Check for at least one authentication mechanism
    const hasAuthMechanism = cookies.includes('JSESSIONID=') || cookies.includes('csrf-token=');
    if (!hasAuthMechanism) {
      console.warn('Missing authentication mechanism (JSESSIONID or csrf-token)');
      return false;
    }
    
    // Check for recommended cookies and warn
    const missingRecommended = recommendedCookies.filter(name => !cookies.includes(`${name}=`));
    if (missingRecommended.length > 0) {
      console.warn(`Missing recommended cookies: ${missingRecommended.join(', ')}. This might affect reliability.`);
    }
    
    return true;
  }

  // Default LinkedIn cookies to use if none are provided
  // const DEFAULT_LINKEDIN_COOKIES = `bcookie="v=2&e6fc6f14-911c-41ae-8edf-5c3aec0475e0"; bscookie="v=1&20250515105330f414afb2-7170-4df9-89c9-cdf8c5167f94AQH0vytddccjQOkQ3dLsuukr897uoI8v"; AMCVS_14215E3D5995C57C0A495C55%40AdobeOrg=1; aam_uuid=76512865538673387150095475607918471654; g_state={"i_l":0}; timezone=Asia/Calcutta; li_theme=light; li_theme_set=app; li_sugr=31f2e8e7-1a8e-462c-8309-4dd8e975ac08; _guid=067a6847-d712-4e8a-8f2f-55b3da797cb5; AnalyticsSyncHistory=AQI0U8j0djd3IQAAAZbT-KW5gGeKAVmLBoB98H1LrQ5cSqpH8w3171flA--TsQXhb6XqC4lYbRv56S2jSU7hSQ; dfpfpt=708bb491597943b59220a327702fbc16; lms_ads=AQEnnxn4ZXU-kQAAAZbT-KcGh3jjRRh_mGztYDY4XJ-N5NbwUKutWt_c7R4CXKOr_mfH_Es3ZYfSFazyKdTB5jxgbwmyACl6; lms_analytics=AQEnnxn4ZXU-kQAAAZbT-KcGh3jjRRh_mGztYDY4XJ-N5NbwUKutWt_c7R4CXKOr_mfH_Es3ZYfSFazyKdTB5jxgbwmyACl6; AMCV_14215E3D5995C57C0A495C55%40AdobeOrg=-637568504%7CMCIDTS%7C20224%7CMCMID%7C77017135437503979680116000347226577453%7CMCAAMLH-1747917811%7C7%7CMCAAMB-1747917811%7C6G1ynYcLPuiQxYZrsz_pkqfLG9yMXBpb2zX5dvJdYQJzPXImdj0y%7CMCOPTOUT-1747320211s%7CNONE%7CvVersion%7C5.1.1%7CMCCIDH%7C-1885044025; fptctx2=taBcrIH61PuCVH7eNCyH0LNKRXFdWqLJ6b8ywJyet7W24uau%252bdAM4LTLaA3CsH8kOG6tTt7Rs%252fhyQphvzN3bxoMLtEDdNFke0X6JEoGkaPpbkRUqSfXejjO8tNMjwMC7KFcpc%252ba1uOhmSJL%252bcRSCUe%252b3vGMxMdfYQvwPqKCqcsexulNE6U6ID38MoM8LCK5WE2xbPOrWC3L%252fDDPgFL601%252fc08lfcFAFNu6BuQkwwm3MAEkG4QBGvwzyqOVW%252btZZkp7i7lRRPK7KZGmS3mz4uqLJPQnoAaT9D72Y8KsiRc9TMng2zW0m1u3bK2Bt8ZWM98q1Sy2PT1FJVAToQ%252fNkobY16GXrlDjjDUoYgBnwwH80%253d; li_rm=AQGQodli8AlVBQAAAZbUAcHXPqJr9G5Odk0_U2QcpUCnFIwBIvDOd0lYDMiMips4S6l9lRrT5eY5FsSnF7nS4Nc4lvqZ07bkcyUj1Mu70XyPtwBOrvxLYwSSXYWqM-W6OoKMheznNOz-6vXzAQaHom5pxhZnjPCK2G_Mz_FaBpycSpDCh_x-xGGv4ByJUYzmuxCfonhzSFgoIbFKlwygYQzMnsNr_mBZwd4alDYaZ3lQwjNwiRw0hJh2fD4YwB-5viiSlWe6jTQRj63kThp-Xt_Ve8q378fQdQoOh12sXcwqTdqW6G8HZFVTjSIU4jDPHs2YXCG1qoPtIjz1N_U; li_g_recent_logout=v=1&true; visit=v=1&M; lang=v=2&lang=en-us; liap=true; li_at=AQEDAT28xqEFxtMJAAABltQCDlgAAAGW-A6SWE0AyhOumPoXc35-oIgFjYe73y6I-x8i9alOhWBa_SZ9dOFw1NqAg3nNHkoI7LRd8n77D5NjbVcQzjPrneW9YEdBYluyj_phXmcJxY_JZdcRz7yE_gHw; JSESSIONID="ajax:7773118606953987583"; UserMatchHistory=AQJqAfelz-OfxAAAAZbUBqXu-xfbZsXtDBdzSfD9gYX0Hrxe-okLiYwDeNp9neAmaLTKLJ73L8gWO_ZZEu4SiGpoOPISEAV8i2PMOp2wSG-d6-f8qSn-8bLrp5i-Z28tmuhpHtF17DVs76ADr9DKzkIOH0cAjO2-LaYLBIw_uWi_zDkuK2I_bh6BOXFUZT8Mk6_bXKvkiAk6bTyzFv6l9CoqSCz_hC13Ola8BEZ2_mqOD64eouggNn8O_HODp9DtVcDPOpMDhxJROs6FlGGagrWSl51Eh7gOZeyGfsaeHwKVtzYacEu7zaLvJ4Z3ShepO7NAxRDIK6k0W7oVHXTO5JJnQyB1KFkSEt0OKpVIvb81tpepfw; lidc="b=VB93:s=V:r=V:a=V:p=V:g=4177:u=13:x=1:i=1747313928:t=1747374583:v=2:sig=AQFHiMk1MqS8KWn3IJUqaGYEd1evYTPt"; _gcl_au=1.1.354426967.1747312983.1304298230.1747315257.1747315257`;
  const DEFAULT_LINKEDIN_COOKIES = "";

  /**
   * Scrapes LinkedIn profiles from a search URL
   */
  async function scrapeLinkedInProfiles(
    searchUrl,
    options= { cookies: "" }
  ) {
    // Use default cookies if not provided
    if (!options.cookies) {
      // options.cookies = DEFAULT_LINKEDIN_COOKIES;
      throw new Error(
        "LinkedIn cookies are required. Please provide them in the options.cookies parameter."
      );
    }

    // Default to 30 profiles as the limit if not specified
    const limit = options.limit || 30;

    // Validate cookies first
    if (!validateCookies(options.cookies)) {
      throw new Error(
        "Invalid LinkedIn cookies. Make sure they contain JSESSIONID and li_at tokens"
      );
    }

    // Extract CSRF token from cookies
    const csrfToken = options.csrfToken || extractCsrfToken(options.cookies);
    if (!csrfToken) {
      throw new Error(
        "CSRF token could not be extracted from cookies. Please check your cookies or provide csrfToken explicitly."
      );
    }

    console.log(`Using CSRF token: ${csrfToken}`);

    // Test if this is likely a valid CSRF token
    if (!csrfToken.startsWith("ajax:")) {
      console.warn(
        'WARNING: CSRF token doesn\'t start with "ajax:" which is unusual for LinkedIn. CSRF check might fail.'
      );
    }

    try {
      // Parse the search URL to extract keywords
      const url = new URL(searchUrl);
      const searchKeywords = url.searchParams.get("keywords") || "";

      console.log(
        `Scraping up to ${limit} LinkedIn profiles for keyword: ${searchKeywords}`
      );

      // Initialize collection for all profiles
      const allProfiles= [];

      // Use pagination to fetch profiles in batches
      let start = 0;

      // Keep fetching until we get the desired number of profiles
      while (allProfiles.length < limit) {
        console.log(`Fetching batch starting at position ${start}...`);

        // Fetch a batch of profiles with the current start position
        const batchProfiles = await fetchLinkedInProfilesBatch(
          searchKeywords,
          csrfToken,
          options.cookies,
          start,
          options.connectionDegrees // Pass the connection degrees filter
        );

        // If no more profiles were found, break the loop
        if (batchProfiles.length === 0) {
          console.log("No more profiles available.");
          break;
        }

        // Add the new profiles to our collection
        allProfiles.push(...batchProfiles);

        console.log(
          `Batch returned ${batchProfiles.length} profiles. Total collected: ${allProfiles.length}/${limit}`
        );

        // Update start position for the next batch
        start += batchProfiles.length;

        // If we've reached or exceeded our limit, or if the batch was smaller than expected, stop
        if (allProfiles.length >= limit || batchProfiles.length < 10) {
          break;
        }

        // Add a small delay between requests to avoid rate limiting
        console.log("Waiting before next batch...");
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Return only up to the requested limit
      return allProfiles.slice(0, limit);
    } catch (error) {
      console.error("Error scraping LinkedIn profiles:", error);
      throw new Error(`LinkedIn scraping failed: ${(error ).message}`);
    }
  }

  /**
   * Fetches a single batch of LinkedIn profiles
   */
  async function fetchLinkedInProfilesBatch(
    keywords,
    csrfToken,
    cookies,
    start = 0,
    connectionDegrees = []
  ) {
    // Construct the network filter if connection degrees are specified
    let networkFilter = "";
    if (connectionDegrees.length > 0) {
      // Create the (key:network,value:List(F,S)) format
      networkFilter = `,(key:network,value:List(${connectionDegrees.join(
        ","
      )}))`;
    }

    // Use FACETED_SEARCH origin and include network filter if specified
    const fullApiUrl = `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(start:${start},origin:FACETED_SEARCH,query:(keywords:${encodeURIComponent(
      keywords
    )},flagshipSearchIntent:SEARCH_SRP,queryParameters:List((key:resultType,value:List(PEOPLE))${networkFilter}),includeFiltersInResponse:false))&queryId=voyagerSearchDashClusters.7cdf88d3366ad02cc5a3862fb9a24085`;

    console.log(
      `Making LinkedIn API request (start=${start}) with connection filter: ${
        connectionDegrees.join(",") || "none"
      }`
    );
    console.log(`Request URL: ${fullApiUrl}`);

    // Get a proxy for this request
    const proxy = getNextProxy();
    const formattedProxy = proxy ? formatProxyForAxios(proxy) : null;
    
    if (formattedProxy) {
      console.log(`Using proxy: ${proxy.replace(/\/\/.*?@/, '//****:****@')}`);
    } else {
      console.log('No proxy available, using direct connection');
    }

    // Use all headers from your working request
    const config = {
      headers: {
        accept: "application/vnd.linkedin.normalized+json+2.1",
        "accept-language": "en-US,en;q=0.8",
        cookie: cookies,
        "csrf-token": csrfToken,
        "x-csrf-token": csrfToken, // Add this header as LinkedIn sometimes checks both
        "x-li-track": '{"clientVersion":"1.13.7252","mpVersion":"1.13.7252","osName":"web","timezoneOffset":5.5,"timezone":"Asia/Calcutta","deviceFormFactor":"DESKTOP","mpName":"voyager-web"}',
        "x-restli-protocol-version": "2.0.0",
        referer: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
          keywords
        )}&origin=SWITCH_SEARCH_VERTICAL`,
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        // These headers remain unchanged
        "x-li-lang": "en_US",
        "x-li-page-instance":
          "urn:li:page:d_flagship3_search_srp_people;V+bdegrrQryB2srvRpjBrA==",
        "x-li-pem-metadata": "Voyager - People SRP=search-results",
      },
      // Try to make proxy request without using the proxy configuration for direct request first
      ...(formattedProxy ? {} : {}),
      timeout: 30000, // Increase timeout
    };

    try {
      // Try direct connection first (without proxy)
      console.log("Attempting direct connection to LinkedIn...");
      const response = await axios.get(fullApiUrl, config);
      
      console.log(`LinkedIn API request succeeded! Response status: ${response.status}`);
      return extractProfilesFromResponse(response.data);
    } catch (directError) {
      console.error("Direct connection failed:", directError.message);
      
      // If direct connection fails, try with proxy
      if (formattedProxy) {
        try {
          console.log("Retrying with proxy...");
          // Add proxy configuration for retry
          config.proxy = formattedProxy;
          const proxyResponse = await axios.get(fullApiUrl, config);
          
          console.log(`LinkedIn API proxy request succeeded! Response status: ${proxyResponse.status}`);
          return extractProfilesFromResponse(proxyResponse.data);
        } catch (proxyError) {
          console.error("Proxy connection also failed:", proxyError.message);
          // Continue to fallback methods
        }
      }
      
      // Try fallback approach for first page if start is 0
      if (start === 0) {
        try {
          console.log("Trying fallback approach with different URL format...");
          // Sometimes LinkedIn requires a simpler URL format
          const fallbackUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
            keywords
          )}&origin=GLOBAL_SEARCH_HEADER`;

          const fallbackResponse = await axios.get(fallbackUrl, {
            ...config,
            headers: {
              ...config.headers,
              accept: "text/html,application/xhtml+xml",
              referer: "https://www.linkedin.com/",
            },
          });

          console.log(
            `Fallback request succeeded with status: ${fallbackResponse.status}`
          );
          // Even if we get HTML back, we can extract some basic profile info
          return extractBasicProfilesFromHTML(fallbackResponse.data);
        } catch (fallbackError) {
          //@ts-ignore
          console.error(
            "Fallback approach also failed:",
            fallbackError.message
          );
        }
      }

      // Special handling for CSRF errors
      if (
        directError.response?.status === 403 &&
        (directError.response?.data?.includes?.("CSRF") ||
          JSON.stringify(directError.response?.data).includes("CSRF"))
      ) {
        throw new Error(`CSRF check failed. Try the following:
1. Get fresh cookies by logging into LinkedIn in your browser
2. Make sure your LinkedIn session is active (try refreshing the LinkedIn page)
3. Manually set the CSRF token using the csrfToken option:
   - Find it in the 'JSESSIONID' cookie value (should start with 'ajax:')
   - The correct format to pass is the entire value including 'ajax:' prefix`);
      }

      // For other errors, return empty array rather than failing
      console.warn(`Returning empty results for batch starting at ${start}`);
      return [];
    }
  }

  /**
   * Extract basic profiles from HTML as a fallback
   */
  function extractBasicProfilesFromHTML(html){
    const profiles = [];

    // Very simple extraction from HTML
    // Look for profile cards in the HTML
    const profileUrlRegex = /\/in\/([^/?]+)/g;
    const matches = html.match(profileUrlRegex);

    if (matches) {
      console.log(`Found ${matches.length} profile URLs in HTML`);

      // De-duplicate profile URLs
      const uniqueUrls = [...new Set(matches)];

      // Create a minimal profile for each URL
      uniqueUrls.forEach((urlPath, index) => {
        const profileUrl = `https://www.linkedin.com${urlPath}`;
        profiles.push({
          id: `html-extract-${index}`,
          name: `Profile ${index + 1}`, // We don't have names from HTML
          profileUrl,
        });
      });
    }

    return profiles;
  }

  /**
   * Extract profiles from LinkedIn API response based on the specific format
   */
  function extractProfilesFromResponse(responseData){
    const profiles = [];

    if (!responseData || !responseData.included) {
      console.log("No included data in response");
      return profiles;
    }

    console.log(`Found ${responseData.included.length} included items`);

    // Extract the elements that have navigationUrl, title, primarySubtitle, secondarySubtitle
    const elements = responseData.included || [];

    // Process only the elements that have all the required fields
    for (const element of elements) {
      try {
        // Check if this is a search result entry with all the fields we need
        if (
          element &&
          element.navigationUrl &&
          element.title &&
          element.title.text &&
          element.primarySubtitle &&
          element.primarySubtitle.text
        ) {
          // Extract URL and trim to just the profile path
          let profileUrl = "";
          if (element.navigationUrl && element.navigationUrl.includes("/in/")) {
            // Get URL up to username (before any parameters)
            const urlParts = element.navigationUrl.split("?")[0];
            profileUrl = urlParts;
          }

          // Create profile object with extracted data
          const profileData= {
            id: element.trackingUrn || element.entityUrn || "",
            name: element.title?.text || "",
            headline: element.primarySubtitle?.text || "",
            location: element.secondarySubtitle?.text || "",
            profileUrl: profileUrl,
          };

          profiles.push(profileData);
        }
      } catch (err) {
        console.error("Error processing profile element:", err);
      }
    }

    console.log(`Successfully extracted ${profiles.length} profiles`);

    return profiles;
  }

  // Enhanced example usage that's ready to run
  async function main(searchUrl, options) {
    // Use provided search URL or default
    const url =
      searchUrl ||
      "https://www.linkedin.com/search/results/people/?keywords=head%20of%20operations";

    console.log(`Scraping profiles from: ${url}`);

    try {
      console.log("Getting LinkedIn cookies...");

      // Ensure cookies are provided - they are required
      if (!options?.cookies) {
        throw new Error(
          "LinkedIn cookies are required. Please provide them via options.cookies or LINKEDIN_COOKIES environment variable."
        );
      }

      // Create a default options object with required cookies property
      const finalOptions= {
        cookies: options?.cookies || "",
        limit: options?.limit || 30,
        connectionDegrees: options?.connectionDegrees,
      };

      const profiles = await scrapeLinkedInProfiles(url, finalOptions);

      console.log(`Successfully scraped ${profiles.length} profiles`);
      console.log(profiles);
      return profiles;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  // Run the main function if this script is executed directly
  // if (require.main === module) {
  //   // Get search URL, limit, and connection degrees from command line
  //   const searchUrl = process.argv[2];
  //   const limitArg = process.argv[3] ? parseInt(process.argv[3]) : 30;
  //   const connectionDegreesArg = process.argv[4];

  //   if (!process.env.LINKEDIN_COOKIES) {
  //     console.log('ERROR: LinkedIn cookies are required!');
  //     console.log('Set your LinkedIn cookies in the LINKEDIN_COOKIES environment variable:');
  //     console.log('  export LINKEDIN_COOKIES="your cookies here" (Linux/Mac)');
  //     console.log('  set LINKEDIN_COOKIES="your cookies here" (Windows)');
  //     process.exit(1);
  //   }

  //   // Set up options with minimal required parameters
  //   const options: Partial<ScrapeOptions> = {
  //     cookies: process.env.LINKEDIN_COOKIES ,
  //     limit: limitArg
  //   };

  //   // Add connection degrees if provided
  //   if (connectionDegreesArg) {
  //     options.connectionDegrees = connectionDegreesArg.split(',') as ('F' | 'S' | 'O')[];
  //     console.log(`Filtering by connection degrees: ${options.connectionDegrees.join(', ')}`);
  //   }

  //   console.log(`Will fetch up to ${options.limit} profiles`);
  //   main(searchUrl, options).catch(console.error);
  // }

  async function runScraper() {
    try {
      // Use the variables directly from the request body scope
      const urlToSearch = searchUrl;
      const cookieString = cookies;
      
      // Log what we're using
      console.log(`Using search URL: ${urlToSearch}`);
      console.log(`Cookie string length: ${cookieString.length} characters`);
      
      // Extract the CSRF token explicitly and add it to options
      const csrfToken = extractCsrfToken(cookieString);
      if (!csrfToken) {
        console.error("Could not extract CSRF token from cookies!");
        throw new Error("CSRF token extraction failed. Please check your cookies format.");
      }
      
      console.log(`Using explicit CSRF token: ${csrfToken}`);
      
      // Define search options
      const options = {
        cookies: cookieString,
        csrfToken: csrfToken, // Use the extracted token
        limit: 10, // Start with a smaller limit for testing
      };

      // Add a small random delay to mimic human behavior
      const randomDelay = Math.floor(Math.random() * 1000) + 500;
      console.log(`Adding random delay of ${randomDelay}ms before request...`);
      await new Promise(resolve => setTimeout(resolve, randomDelay));
      
      // Execute the search
      console.log("Starting LinkedIn profile search...");
      const profiles = await scrapeLinkedInProfiles(urlToSearch, options);

      console.log(`Found ${profiles.length} profiles`);
      return profiles;
    } catch (error) {
      console.error("Error in runScraper:", error);
      throw error; // Re-throw to be caught by the outer catch
    }
  }

  const results = await runScraper().catch(console.error);

  console.log("Scraper results:", results);
  res.json({
    message: "Scraping completed", 
    profiles: results
  });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
