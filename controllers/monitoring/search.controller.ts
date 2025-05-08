import { Request, Response } from "express";
import { locations } from "../../utils/location.helpers";
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config()
export async function getAllLocations(req:Request, res:Response){
    res.status(200).json(locations)
}


// Helper to filter valid params
const validParams = [
  'q', 'page', 'perPage', 'sort', 'tags', 'locations', 'genders', 'ages',
  'minAge', 'maxAge', 'socialTypes', 'minUsersCount', 'maxUsersCount',
  'minER', 'maxER', 'minViews', 'maxViews', 'audienceLocations', 'audienceGenders',
  'audienceAges', 'minAudienceAge', 'maxAudienceAge', 'minLikes', 'maxLikes',
  'minComments', 'maxComments', 'minVideoLikes', 'maxVideoLikes', 'minVideoComments',
  'maxVideoComments', 'minVideoViews', 'maxVideoViews', 'minFakeFollowers',
  'maxFakeFollowers', 'minQualityScore', 'maxQualityScore', 'trackTotal',
  'minInteractions', 'maxInteractions', 'minAudienceLocationsPercent',
  'minAudienceGendersPercent', 'minAudienceAgePercent', 'isVerified', 'isContactEmail'
];

export const searchInfluencers = async (req: Request, res: Response) => {
  try {
    // Filter and clean incoming parameters
    const filteredParams: Record<string, string> = {};
    for (const key of validParams) {
      if (req.body[key] !== undefined && req.body[key] !== null && req.body[key] !== '') {
        filteredParams[key] = String(req.body[key]);
      }
    }
    if(!filteredParams.page){
        filteredParams.page = "1"
    }
    if(!filteredParams.perPage){
        filteredParams.perPage = "20"
    }

    const options = {
      method: 'GET',
      url: 'https://instagram-statistics-api.p.rapidapi.com/search',
      params: filteredParams,
      headers: {
        'x-rapidapi-key': process.env.INSTAGRAM_STATS_API_KEY,
        'x-rapidapi-host': 'instagram-statistics-api.p.rapidapi.com'
      }
    };

    const response = await axios.request(options);

    const finalRes = response.data.data.map((i:any)=>{
        return {
            userId:i.groupId,
            name:i.name,
            username:i.screenName,
            followers:i.usersCount,
            engagement_rate:i.avgER * 100,
            type:i.type,
            profile_pic:i.image,
            categories:i.categories,
            contentQuality:i.qualityScore * 100,
            email:i.contactEmail,
            bio:i.description,
            verified:i.verified,
        }
    })
    res.status(200).json({data:finalRes});
    return 
  } catch (error: any) {
    console.error('Search API error:', error?.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to fetch influencer data.',
      details: error?.response?.data || error.message
    });
    return 
}
}
  