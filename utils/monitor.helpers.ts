export function getDayOfWeekFromMicroseconds(microTimestamp:number) {
  
    // Convert microseconds to milliseconds
    const milliseconds = Math.floor(microTimestamp / 1000);
  
    // Create a Date object
    const date = new Date(milliseconds);
  
    // Array of weekday names
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
    // Get day index and return day name
    return days[date.getUTCDay()];
  }
  
export function estimateCostPerPost(followers: number, engagementRate: number): number {
    let multiplier = 10;
  
    if (engagementRate > 6) multiplier = 40;
    else if (engagementRate > 3) multiplier = 25;
    else if (engagementRate > 1) multiplier = 15;
    else multiplier = 8;
  
    return Math.round((followers / 1000) * engagementRate * multiplier);
  }
  
  export function parseRangeName(name:string) {
    const match = name.match(/^r(\d+)_?(\d+|plus)?$/);
    if (!match) return name;
  
    const from = match[1];
    const to = match[2];
  
    if (to === "plus") {
      return `${from}+`;
    } else if (to) {
      return `${from}-${to}`;
    } else {
      return from;
    }
  }


  type PostPriceInput = {
    followers: number;
    avgLikes: number;
    avgComments: number;
    following: number;
    pctFakeFollowers: number; // e.g., 0.18 for 18%
    estimatedViewsPerPost?: number; // optional, fallback to followers × 0.3
    baseCPM?: number; // optional override
    isBrandSafe?: boolean;
  };
  
  function getBaseCPM(followers: number): number {
    if (followers < 10_000) return 10;
    else if (followers < 100_000) return 20;
    else if (followers < 500_000) return 35;
    else if (followers < 1_000_000) return 60;
    else return 90;
  }
  
  export function estimatePricePerPost(input: PostPriceInput): {
    estimatedPrice: number;
    adjustedCPM: number;
    estimatedViews: number;
  } {
    const {
      followers,
      avgLikes,
      avgComments,
      following,
      pctFakeFollowers,
      estimatedViewsPerPost,
      baseCPM,
      isBrandSafe = true,
    } = input;
  
    const base = baseCPM ?? getBaseCPM(followers);
  
    // Engagement Rate
    const engagementRate = (avgLikes + avgComments) / followers;
    let engagementFactor = 1.0;
    if (engagementRate > 0.03) engagementFactor = 1.3;
    else if (engagementRate < 0.01) engagementFactor = 0.7;
  
    // Authenticity
    const authenticityFactor = 1 - pctFakeFollowers;
  
    // Follower-to-following ratio
    const ratio = followers / Math.max(following, 1);
    let ratioFactor = 1.0;
    if (ratio > 3.0) ratioFactor = 1.2;
    else if (ratio < 1.0) ratioFactor = 0.7;
  
    // Brand Safety
    const brandSafetyFactor = isBrandSafe ? 1.1 : 1.0;
  
    // Final Adjusted CPM
    const adjustedCPM = base * engagementFactor * authenticityFactor * ratioFactor * brandSafetyFactor;
  
    // Estimate Views (fallback: 30% of followers)
    const estimatedViews = estimatedViewsPerPost ?? Math.round(followers * 0.3 * authenticityFactor);
  
    // Final Price Estimate
    const estimatedPrice = (estimatedViews / 1000) * adjustedCPM;
  
    return {
      estimatedPrice: parseFloat(estimatedPrice.toFixed(2)),
      adjustedCPM: parseFloat(adjustedCPM.toFixed(2)),
      estimatedViews,
    };
  }
  

  export function getCurrentDateFormatted(custom_year?:number) {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    const year = today.getFullYear();
    return `${day}.${month}.${custom_year||year}`;
  }
  