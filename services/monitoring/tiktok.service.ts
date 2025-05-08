import axios from "axios"
import type { TiktokUserData } from "../../types"
import { getCurrentDateFormatted, parseRangeName } from "../../utils/monitor.helpers"

export const fetchTiktokProfile = async (username: string): Promise<TiktokUserData | null> => {
  try {
    // Fetch profile information
 

    const stats = await axios.get("https://instagram-statistics-api.p.rapidapi.com/community", {
      params:{
        url:"https://www.tiktok.com/@" + username,
      },
      headers: {
        'x-rapidapi-key': process.env.INSTAGRAM_STATS_API_KEY,
        'x-rapidapi-host': 'instagram-statistics-api.p.rapidapi.com'
      }
    })    

    const statsRes = stats.data.data

    const similarAccounts = await axios.get("https://instagram-statistics-api.p.rapidapi.com/search", {
      params:{
        page:"1",
        perPage:"20",
        sort:"-score",
        tags: statsRes.categories[0],
        socialTypes:"TT",
        trackTotal:"true",
      },
      headers: {
        'x-rapidapi-key': process.env.INSTAGRAM_STATS_API_KEY,
        'x-rapidapi-host': 'instagram-statistics-api.p.rapidapi.com'
      }
    })

    const similar = similarAccounts.data.data.map((i:any)=>{
      return {
        name:i.name,
        username:i.screenName,
        id:i.groupId,
        engagement_rate:i.avgER * 100,
        type:i.type,
        gender:i.gender,
        image:i.image
      }
    })

    const collabs = statsRes.lastFromMentions.map((i:any)=>{
      return {
        id:i.cid.replace("TT:",""),
        name:i.name,
        url:i.url,
      }
    })
    const reachablitity = statsRes.membersReachability.map((i:any)=>{
          return {
            range:parseRangeName(i.name),
            value:i.percent*100,
          }
        })
    const finalStats = {
      tags: statsRes.suggestedTags,
      audienceQuality: statsRes.qualityScore,
      memebers_by_city: statsRes.membersCities.map((i:any)=>{return{name:i.category,value:i.value*100}}),
      memebers_by_country: statsRes.membersCountries.map((i:any)=>{return{name:i.name,value:i.value*100}}),
      members_by_gender_age:statsRes.membersGendersAges.data.map((i:any)=>{
        return {
          age_group:i.category,
          male:i.m*100,
          female:i.f*100,
        }
      }),
      averageAccountLikes:statsRes.avgLikes,
      averageAccountComments:statsRes.avgComments,
      type:statsRes.type,
      country:statsRes.country,
      city:statsRes.city,
      memberTypes:statsRes.membersTypes.map((i:any)=>{return{name:i.name,value:i.percent*100}}),
      similarAccounts:similar,
      collabs:collabs,
      reachablitity,
      interactions:statsRes.avgInteractions,
      email:statsRes.contactEmail,
      engagement_rate: statsRes.avgER * 100
    }

    // Prepare profile data
    const profileData:any = {
      username: statsRes.screenName,
      full_name: statsRes.name,
      profile_pic_url: statsRes.image,
      bio: statsRes.description,
      followers: statsRes.usersCount,
      likes: statsRes.likes,
      comments:statsRes.comments,
      following:0,
      videos: statsRes.media_count,
      is_verified: statsRes.verified,
      recent_videos: [],
      total_likes: statsRes.avgLikes,
      total_comments: statsRes.avgComments,
      total_shares: 0,
      total_views: statsRes.avgViews,
      engagement_rate: statsRes.avgER * 100,
      timestamp: new Date().toISOString(),
      stats:finalStats,
      posts_count:0,
    }

    // Fetch recent videos
    const postsResponse = await axios.get(`https://instagram-statistics-api.p.rapidapi.com/posts`, {
      params: { cid:statsRes.cid,  social_type:"TT", from: getCurrentDateFormatted(2024), to:getCurrentDateFormatted(), type:"posts", sort:"date"},
      headers:{
        'x-rapidapi-key': process.env.INSTAGRAM_STATS_API_KEY,
        'x-rapidapi-host': 'instagram-statistics-api.p.rapidapi.com',
      }
      })


    const postsData = postsResponse.data?.data?.posts || []
    for (const post of postsData) {
      // Fetch up to 10 recent posts
      let hashtags: string[] = post.hashTags
      let mentions: string[] = post.mentionsText


      const postData = {
        post_id: post.postId,
        caption: post.text || "",
        media_url: post.postImage,
        video_url: post.videoLink,
        post_url:post.postUrl,
        post_type: post.type,
        timestamp: post.date,
        likes: post.likes || 0,
        comments: post.comments || 0,
        isAd: post.isAd,
        interactions:post.interactions,
        engagement_rate: post.er*100,
        grade:post.grade,
        hashtags,
        mentions,
        video_view_count: post.views,
      }

      profileData.recent_videos.push(postData)
    
    }

    console.log(Object.keys(profileData))

    return profileData
  } catch (error) {
    console.error(`Error fetching TikTok data for ${username}:`, error)
    return null
  }
}
