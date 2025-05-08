import axios from "axios"
import type { YoutubeUserData, YoutubeVideo } from "../../types"
import { google } from "googleapis"
import e from "express"
import { parseRangeName } from "../../utils/monitor.helpers"

// Initialize YouTube API client
const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_SERVICE_KEY,
})

/**
 * Convert UTC time to local time
 */
function convertToLocalTime(dateStr: string): string {
  // Parse the date string and convert to a Date object
  const utcTime = new Date(dateStr)

  // Return ISO string (this will be in local time when displayed in the browser)
  return utcTime.toISOString()
}

/**
 * Get channel ID from username
 */
async function getChannelIdFromUsername(username: string): Promise<string | null> {
  try {
    const response = await youtube.search.list({
      part: ["snippet"],
      q: username,
      type: ["channel"],
      maxResults: 1,
    })

    if (!response.data.items || response.data.items.length === 0) {
      return null
    }

    return response.data.items[0].id?.channelId || null
  } catch (error) {
    console.error(`Error fetching channel ID for ${username}:`, error)
    return null
  }
}

/**
 * Fetch YouTube profile and recent videos
 */
export async function fetchYoutubeProfile(username: string): Promise<YoutubeUserData | null> {

  // Get Channel ID from username
  const channelId = await getChannelIdFromUsername(username)
  if (!channelId) {
    console.log(`Channel not found for username: ${username}`)
    return null
  }

  try {
    // Fetch channel details
    const channelResponse = await youtube.channels.list({
      part: ["snippet", "statistics"],
      id: [channelId],
    })

    if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
      return null
    }

    const channelInfo = channelResponse.data.items[0]
    const snippet = channelInfo.snippet || {}
    const statistics = channelInfo.statistics || {}


    const stats = await axios.get("https://instagram-statistics-api.p.rapidapi.com/community", {
      params:{
        url:"https://www.youtube.com/@" + username,
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
        socialTypes:"YT",
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
        id:i.cid.replace("YT:",""),
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
      memebers_by_country: statsRes.countries.map((i:any)=>{return{name:i.name,value:i.percent*100}}),
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
      collabs,
      reachablitity,
      interactions:statsRes.avgInteractions,

    }



    const profileData: YoutubeUserData = {
      username: username,
      channel_name: snippet.title || username,
      description: snippet.description || "",
      profile_pic_url: snippet.thumbnails?.high?.url || "",
      subscribers: Number.parseInt(statistics.subscriberCount || "0", 10),
      total_views: Number.parseInt(statistics.viewCount || "0", 10),
      total_videos: Number.parseInt(statistics.videoCount || "0", 10),
      recent_videos: [],
      total_likes: 0,
      total_comments: 0,
      engagement_rate: 0,
      timestamp: new Date().toISOString(),
      stats: finalStats,
    }

    let totalLikes = 0
    let totalComments = 0

    // Fetch uploads playlist ID
    const playlistResponse = await youtube.channels.list({
      part: ["contentDetails"],
      id: [channelId],
    })

    if (!playlistResponse.data.items || playlistResponse.data.items.length === 0) {
      return profileData
    }

    const uploadsPlaylistId = playlistResponse.data.items[0].contentDetails?.relatedPlaylists?.uploads

    if (!uploadsPlaylistId) {
      return profileData
    }

    // Fetch recent videos
    const videosResponse = await youtube.playlistItems.list({
      part: ["snippet"],
      playlistId: uploadsPlaylistId,
      maxResults: 10,
    })

    if (!videosResponse.data.items || videosResponse.data.items.length === 0) {
      return profileData
    }

    // Extract video IDs
    const videoIds = videosResponse.data.items
      .map((item) => item.snippet?.resourceId?.videoId)
      .filter(Boolean) as string[]

    if (videoIds.length === 0) {
      return profileData
    }

    // Fetch video statistics
    const videosStatsResponse = await youtube.videos.list({
      part: ["snippet", "statistics"],
      id: videoIds,
    })

    if (!videosStatsResponse.data.items) {
      return profileData
    }

    // Process video data
    for (const video of videosStatsResponse.data.items) {
      const stats = video.statistics || {}
      const videoLikes = Number.parseInt(stats.likeCount || "0", 10)
      const videoComments = Number.parseInt(stats.commentCount || "0", 10)
      const videoViews = Number.parseInt(stats.viewCount || "0", 10)

      totalLikes += videoLikes
      totalComments += videoComments

      const engagementRate =
        profileData.subscribers > 0 ? ((videoLikes + videoComments) / profileData.subscribers) * 100 : 0

      const videoData: YoutubeVideo = {
        video_id: video.id || "",
        title: video.snippet?.title || "",
        description: video.snippet?.description || "",
        published_at: video.snippet?.publishedAt ? convertToLocalTime(video.snippet.publishedAt) : "",
        thumbnail_url: video.snippet?.thumbnails?.high?.url || "",
        likes: videoLikes,
        comments: videoComments,
        views: videoViews,
        engagement_rate: Number.parseFloat(engagementRate.toFixed(2)),
      }

      profileData.recent_videos.push(videoData)
    }

    // Update profile with aggregated data
    profileData.total_likes = totalLikes
    profileData.total_comments = totalComments

    // Calculate channel engagement rate
    profileData.engagement_rate =
      profileData.subscribers > 0
        ? Number.parseFloat((((totalLikes + totalComments) / profileData.subscribers) * 100).toFixed(2))
        : 0
    return profileData
  } catch (error) {
    console.error(`Error fetching data for ${username}:`, error)
    return null
  }
}
