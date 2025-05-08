import { Request, Response } from "express"
import { google } from "googleapis"
import pool from "../../../config/db.config"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import axios from "axios"
import dotenv from "dotenv"

dotenv.config()


const oauth2Client = new google.auth.OAuth2(
  process.env.YT_CLIENT_ID,
  process.env.YT_CLIENT_SECRET,
  process.env.YT_REDIRECT_URI
)

export const setOAuthToken = async (req: Request, res: Response) => {
  try {
    const { code } = req.body
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)
     res.status(200).json({ success: true, tokens })
     return
  } catch (err: any) {
    console.error("OAuth error:", err)
    res.status(500).json({ success: false, error: err.message })
    return 
  }
}

const youtube = google.youtube({ version: "v3", auth: oauth2Client })

export const scheduleVideo = async (req: Request, res: Response) => {
  console.log(req.body)
  const { video, title, description, scheduledTime, tags, user_id } = req.body
  try {
    
    const videoStream = await axios({
      url: video,
      method: 'GET',
      responseType: 'stream',
    })

    if (!videoStream) { res.status(400).json({ success: false, error: "Video file missing." })
        return
    }

    const videoMetadata = {
      snippet: {
        title,
        description,
        tags: tags ? tags.split(",") : [],
        scheduledStartTime: scheduledTime || undefined,
      },
      status: {
        privacyStatus: scheduledTime ? "private" : "public",
        publishAt: scheduledTime || undefined,
        selfDeclaredMadeForKids: false,
      },
    }

    const media = { body: videoStream.data }
    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: videoMetadata,
      media,
    })


    await pool.query(
      `INSERT INTO scheduled_jobs_yt (type, title, description, scheduled_time, youtube_id, platform, userId)
       VALUES ($1, $2, $3, $4, $5, 'yt', $6)`,
      ['video', title, description, scheduledTime, response.data.id, user_id]
    )

     res.status(200).json({ success: true, videoId: response.data.id })
     return
  } catch (err: any) {
    console.error("Video schedule error:", err)
     res.status(500).json({ success: false, error: err.message })
     return
  }
}

export const scheduleLive = async (req: Request, res: Response) => {
  try {
    const { title, description, startTime, endTime, user_id } = req.body

    const broadcastRes = await youtube.liveBroadcasts.insert({
      part: ["snippet", "status", "contentDetails"],
      requestBody: {
        snippet: { title, description, scheduledStartTime: startTime, scheduledEndTime: endTime },
        status: { privacyStatus: "public" },
        contentDetails: { monitorStream: { enableMonitorStream: false } },
      },
    })

    const streamRes = await youtube.liveStreams.insert({
      part: ["snippet", "cdn", "status"],
      requestBody: {
        snippet: { title: `${title} Stream` },
        cdn: { format: "1080p", ingestionType: "rtmp" },
        status: { streamStatus: "active" },
      },
    })

    await youtube.liveBroadcasts.bind({
      id: broadcastRes.data.id!,
      part: ["id", "snippet"],
      streamId: streamRes.data.id!,
    })

    await pool.query(
      `INSERT INTO scheduled_jobs_yt (type, title, description, scheduled_time, youtube_id, platform, userId)
       VALUES ($1, $2, $3, $4, $5, 'yt', $6)`,
      ['live', title, description, startTime, broadcastRes.data.id, user_id]
    )

     res.status(200).json({
      success: true,
      broadcastId: broadcastRes.data.id,
      streamId: streamRes.data.id,
      ingestionInfo: streamRes.data.cdn?.ingestionInfo,
    })
    return
  } catch (err: any) {
    console.error("Live schedule error:", err)
     res.status(500).json({ success: false, error: err.message })
     return
  }
}

export const getScheduledMedia = async (req: Request, res: Response) => {
  const {userId} = req.query
  console.log("userId", userId)
  
  try {
    await pool.query(`DELETE FROM scheduled_jobs_yt WHERE scheduled_time < NOW();`)
    const result = await pool.query(`SELECT * FROM scheduled_jobs_yt WHERE userid = $1 ORDER BY scheduled_time ASC;`, [userId])
     res.status(200).json({ success: true, media: result.rows })
     return
  } catch (err: any) {
    console.error("Error fetching scheduled media:", err)
     res.status(500).json({ success: false, error: err.message })
     return
  }
}

const s3 = new S3Client({ region: 'us-west-1', credentials:{
  accessKeyId:process.env.AWS_S3_ACCESS_KEY as string,
  secretAccessKey:process.env.AWS_S3_SECRET_KEY as string,
} })

export const getYoutubeBucketUrl = async (req: Request, res: Response) => {
  try{
  const { filename, filetype } = req.body
  const bucket = process.env.AWS_BUCKET_NAME
  const key = `uploads/${Date.now()}-${filename}`

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: filetype,
  })

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60000 })
  const fileUrl = `https://${bucket}.s3.amazonaws.com/${key}`

  res.json({ uploadUrl, fileUrl })
}
catch(err){
  console.log(err)
}
}