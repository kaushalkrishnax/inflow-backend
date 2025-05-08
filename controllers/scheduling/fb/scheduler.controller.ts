import { scheduleJob } from "node-schedule"
import fs from "fs"
import path from "path"
import axios from "axios"
import FormData from "form-data"
import { FacebookAdsApi, Page } from "facebook-nodejs-business-sdk"
import { getAllScheduledJobs, saveScheduledJob, updateJobStatus } from "../../../utils/job.helpers"


const scheduledJobs = new Map()

function formatTimeRemaining(seconds: number): string {
  if (seconds < 0) return "Overdue"

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (remainingSeconds > 0 && days === 0) parts.push(`${remainingSeconds}s`)

  return parts.join(" ")
}

// Helper function to determine media type
function getMediaType(mimetype: string): "image" | "video" | null {
  if (!mimetype) return null

  if (mimetype.startsWith("image/")) {
    return "image"
  } else if (mimetype.startsWith("video/")) {
    return "video"
  }

  return null
}

// Initialize Facebook SDK
function initFacebookSDK(accessToken: string) {
  FacebookAdsApi.init(accessToken)
}

// Helper function to upload a video to Facebook using the SDK
async function uploadVideoToFacebook(videoPath: string, pageId: string, accessToken: string, message: string) {
  console.log(`Uploading video from path: ${videoPath}`)

  try {
    // Check if file exists and is readable
    if (!fs.existsSync(videoPath)) {
      throw new Error(`File does not exist at path: ${videoPath}`)
    }

    // Get file stats to verify it's not empty
    const stats = fs.statSync(videoPath)
    if (stats.size === 0) {
      throw new Error(`File is empty: ${videoPath}`)
    }

    console.log(`File exists and has size: ${stats.size} bytes`)

    // Create form data with proper boundaries
    const formData = new FormData()

    // Read file as buffer instead of stream
    const fileBuffer = fs.readFileSync(videoPath)

    // Append the file with proper filename and content type
    formData.append("source", fileBuffer, {
      filename: path.basename(videoPath),
      contentType: "video/mp4", // You might want to detect this dynamically
    })

    formData.append("access_token", accessToken)
    formData.append("title", message.substring(0, 100))
    formData.append("description", message)
    formData.append("published", "true")

    console.log(`Sending video upload request to Facebook for page ${pageId}`)

    // Make the API request with proper headers
    const response = await axios.post(`https://graph.facebook.com/v19.0/${pageId}/videos`, formData, {
      headers: {
        ...formData.getHeaders(),
        "Content-Length": formData.getLengthSync().toString(),
      },
      maxContentLength: Number.POSITIVE_INFINITY,
      maxBodyLength: Number.POSITIVE_INFINITY,
      timeout: 60000, // 60 seconds timeout for large uploads
    })

    console.log(`Video upload successful, response:`, response.data)
    return response.data
  } catch (error: any) {
    console.error(`Error in uploadVideoToFacebook:`, error.message)
    if (error.response?.data) {
      console.error(`Response data:`, JSON.stringify(error.response.data, null, 2))
    }
    throw error
  }
}

// Helper function to upload an image to Facebook using the SDK
async function uploadImageToFacebook(imagePath: string, pageId: string, accessToken: string, message: string) {
  console.log(`Uploading image from path: ${imagePath}`)

  try {
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`File does not exist at path: ${imagePath}`)
    }

    // Create a boundary for multipart form data
    const boundary = "----WebKitFormBoundary" + Math.random().toString(16).substr(2)

    // Read file as buffer
    const fileBuffer = fs.readFileSync(imagePath)

    // Create multipart form data manually
    let data = ""

    // Add access token
    data += `--${boundary}\r\n`
    data += 'Content-Disposition: form-data; name="access_token"\r\n\r\n'
    data += `${accessToken}\r\n`

    // Add caption
    data += `--${boundary}\r\n`
    data += 'Content-Disposition: form-data; name="caption"\r\n\r\n'
    data += `${message}\r\n`

    // Add file header
    data += `--${boundary}\r\n`
    data += `Content-Disposition: form-data; name="source"; filename="${path.basename(imagePath)}"\r\n`
    data += "Content-Type: image/jpeg\r\n\r\n"

    // Create the request body by concatenating the form data with the file buffer
    const requestBody = Buffer.concat([
      Buffer.from(data, "utf8"),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"),
    ])

    console.log(`Sending image upload request to Facebook for page ${pageId}`)

    // Make the API request with proper headers
    const response = await axios.post(`https://graph.facebook.com/v19.0/${pageId}/photos`, requestBody, {
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": requestBody.length.toString(),
      },
      maxContentLength: Number.POSITIVE_INFINITY,
      maxBodyLength: Number.POSITIVE_INFINITY,
    })

    console.log(`Image upload successful, response:`, response.data)
    return response.data
  } catch (error: any) {
    console.error(`Error in uploadImageToFacebook:`, error.message)
    if (error.response?.data) {
      console.error(`Response data:`, JSON.stringify(error.response.data, null, 2))
    }
    throw error
  }
}

// Helper function to upload a reel to Facebook
async function uploadReelToFacebook(videoPath: string, pageId: string, accessToken: string, description: string) {
  console.log(`Uploading reel from path: ${videoPath}`)

  try {
    const API_VERSION = "v19.0"

    // Start upload session
    const startResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/${pageId}/video_reels`, {
      upload_phase: "start",
      access_token: accessToken,
    })

    if (!startResponse.data.video_id || !startResponse.data.upload_url) {
      throw new Error("Failed to get valid upload session")
    }

    const videoId = startResponse.data.video_id
    const uploadUrl = startResponse.data.upload_url

    const fileSize = fs.statSync(videoPath).size

    // Upload video
    const uploadResponse = await axios.post(uploadUrl, fs.createReadStream(videoPath), {
      headers: {
        Authorization: `OAuth ${accessToken}`,
        file_size: fileSize.toString(),
        offset: "0",
        "Content-Type": "application/octet-stream",
        "Content-Length": fileSize.toString(),
      },
      maxContentLength: Number.POSITIVE_INFINITY,
      maxBodyLength: Number.POSITIVE_INFINITY,
      timeout: 60000,
    })

    if (uploadResponse.status !== 200) {
      throw new Error(`Video upload failed with status ${uploadResponse.status}`)
    }

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 10000))

    // Finish upload and publish
    const finishResponse = await axios.post(`https://graph.facebook.com/${API_VERSION}/${pageId}/video_reels`, {
      upload_phase: "finish",
      video_state: "PUBLISHED",
      description: description,
      video_id: videoId,
      access_token: accessToken,
    })

    // Wait for publishing
    await new Promise((resolve) => setTimeout(resolve, 10000))

    const reelId = finishResponse.data.post_id || finishResponse.data.id
    if (!reelId) {
      throw new Error("Failed to get valid reel ID in finish response")
    }

    console.log(`Reel upload successful, response:`, finishResponse.data)
    return finishResponse.data
  } catch (error: any) {
    console.error(`Error in uploadReelToFacebook:`, error.message)
    if (error.response?.data) {
      console.error(`Response data:`, error.response.data)
    }
    throw error
  }
}

// Helper function to post a story to Facebook
async function postStoryToFacebook(mediaPath: string, pageId: string, accessToken: string, mediaType: string) {
  console.log(`Posting story from path: ${mediaPath}`)

  try {
    const fileBuffer = fs.readFileSync(mediaPath)
    const isVideo = mediaType.startsWith("video/")

    const formData = new FormData()
    formData.append("access_token", accessToken)
    formData.append("source", fileBuffer, { filename: path.basename(mediaPath) })
    formData.append("published", "false")

    const endpoint = isVideo
      ? `https://graph.facebook.com/v19.0/${pageId}/videos`
      : `https://graph.facebook.com/v19.0/${pageId}/photos`

    const response = await axios.post(endpoint, formData, {
      headers: formData.getHeaders(),
    })

    const story = await axios.post(
      `https://graph.facebook.com/v19.0/${pageId}/${isVideo ? "video" : "photo"}_stories`,
      {
        ...(isVideo ? { video_id: response.data.id } : { photo_id: response.data.id }),
        ...(isVideo && { upload_phase: "finish" }),
        access_token: accessToken,
      },
    )

    console.log(`Story post successful, response:`, response.data)
    return response.data
  } catch (error: any) {
    console.error(`Error in postStoryToFacebook:`, error.message)
    if (error.response?.data) {
      console.error(`Response data:`, error.response.data)
    }
    throw error
  }
}

// Main function to schedule or post content to Facebook
export async function schedulePostsForPages(req: any, res: any) {
  try {
    const { page_access_token, page_id, message, scheduled_time } = req.body
    const media = req.file

    // Validate required parameters
    if (!page_access_token || !page_id || !message) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
        details: "Page ID, Access Token and Message are required.",
      })
    }

    // Determine media type if media exists
    const mediaType = media ? getMediaType(media.mimetype) : null

    // Log media information for debugging
    if (media) {
      console.log("Media information:", {
        originalname: media.originalname,
        mimetype: media.mimetype,
        size: media.size,
        path: media.path,
        type: mediaType,
      })
    }

    // If scheduled_time is present, set up a cron job
    if (scheduled_time) {
      const scheduledDate = new Date(scheduled_time)

      // Validate the date is in the future
      if (scheduledDate <= new Date()) {
        return res.status(400).json({
          success: false,
          error: "Invalid scheduled time",
          details: "Scheduled time must be in the future",
        })
      }

      // Create a unique job ID
      const jobId = `post_${page_id}_${Date.now()}`

      // Store media path if it exists
      const mediaPath = media ? media.path : null

      // Schedule the job
      const job = scheduleJob(scheduledDate, async () => {
        try {
          console.log(`Executing scheduled post job ${jobId} at ${new Date()}`)

          // Handle media attachment if it exists
          if (mediaPath) {
            try {
              if (mediaType === "video") {
                // For videos - use the SDK method
                const mediaResponse = await uploadVideoToFacebook(mediaPath, page_id, page_access_token, message)

                console.log(`Successfully published scheduled video ${jobId}, post ID: ${mediaResponse.id}`)
              } else {
                // For images - use the SDK method
                const mediaResponse = await uploadImageToFacebook(mediaPath, page_id, page_access_token, message)

                console.log(`Successfully published scheduled image ${jobId}, post ID: ${mediaResponse.id}`)
              }
            } catch (mediaError: any) {
              console.error(`Error uploading media for scheduled post ${jobId}:`, mediaError.message)
              if (mediaError.response?.data) {
                console.error("Response data:", JSON.stringify(mediaError.response.data, null, 2))
              }
            }
          } else {
            // Text-only post
            initFacebookSDK(page_access_token)
            const page = new Page(page_id)

            const postResponse = await page.createFeed([],{
              
              message: message,
              published: true,
            })

            console.log(`Successfully published scheduled post ${jobId}, post ID: ${postResponse.id}`)
          }

          // Clean up media file if it exists
          if (mediaPath) {
            try {
              fs.unlinkSync(mediaPath)
            } catch (unlinkError) {
              console.error(`Error deleting media file for job ${jobId}:`, unlinkError)
            }
          }

          // Remove job from the map
          scheduledJobs.delete(jobId)
        } catch (jobError: any) {
          console.error(`Error executing scheduled post job ${jobId}:`, jobError.message)
          if (jobError.response?.data) {
            console.error("Response data:", JSON.stringify(jobError.response.data, null, 2))
          }
        }
      })

      // Store the job in our map
      scheduledJobs.set(jobId, {
        job,
        mediaPath,
        details: {
          type: "post",
          page_id,
          message,
          scheduled_time: scheduledDate,
          has_media: !!media,
          media_type: mediaType,
        },
      })

      await saveScheduledJob({
        job_id: jobId,
        type: "post",
        page_id,
        message,
        scheduled_time: scheduledDate,
        has_media: !!media,
        media_type: mediaType,
        media_path: media?.path || null,
      })

      // Calculate time remaining in seconds
      const timeRemaining = Math.floor((scheduledDate.getTime() - Date.now()) / 1000)

      // Return 201 Created with job ID and details
      return res.status(201).json({
        success: true,
        job_id: jobId,
        scheduled_time: scheduledDate.toISOString(),
        time_remaining: {
          seconds: timeRemaining,
          formatted: formatTimeRemaining(timeRemaining),
        },
        content_type: "post",
        has_media: !!media,
        media_type: mediaType,
      })
    } else {
      // If no scheduled_time, post immediately
      if (media) {
        if (mediaType === "video") {
          // For videos
          try {
            // Use the SDK method
            const mediaResponse = await uploadVideoToFacebook(media.path, page_id, page_access_token, message)

            // Clean up media file
            if (media.path) {
              try {
                fs.unlinkSync(media.path)
              } catch (unlinkError) {
                console.error("Error deleting media file:", unlinkError)
              }
            }

            // Return 200 OK with post ID
            return res.status(200).json({
              success: true,
              post_id: mediaResponse.id,
              content_type: "video",
              published: true,
              publish_time: new Date().toISOString(),
            })
          } catch (error: any) {
            console.error("Error uploading video:", error.message)

            // Log detailed error information
            if (error.response) {
              console.error("Response status:", error.response.status)
              console.error("Response headers:", error.response.headers)
              console.error("Response data:", JSON.stringify(error.response.data, null, 2))
            } else if (error.request) {
              console.error("No response received, request:", error.request)
            } else {
              console.error("Error setting up request:", error.message)
            }

            // Clean up media file on error
            if (media.path) {
              try {
                fs.unlinkSync(media.path)
              } catch (unlinkError) {
                console.error("Error deleting media file:", unlinkError)
              }
            }

            return res.status(500).json({
              success: false,
              error: "Failed to upload video",
              message: error.message || "Unknown error",
              details: error.response?.data || null,
            })
          }
        } else {
          // For images - use the SDK method
          try {
            const mediaResponse = await uploadImageToFacebook(media.path, page_id, page_access_token, message)

            // Clean up media file
            if (media.path) {
              try {
                fs.unlinkSync(media.path)
              } catch (unlinkError) {
                console.error("Error deleting media file:", unlinkError)
              }
            }

            // Return 200 OK with post ID
            return res.status(200).json({
              success: true,
              post_id: mediaResponse.id,
              content_type: "image",
              published: true,
              publish_time: new Date().toISOString(),
            })
          } catch (error: any) {
            console.error("Error uploading image:", error.message)
            if (error.response?.data) {
              console.error("Response data:", JSON.stringify(error.response.data, null, 2))
            }

            // Clean up media file on error
            if (media.path) {
              try {
                fs.unlinkSync(media.path)
              } catch (unlinkError) {
                console.error("Error deleting media file:", unlinkError)
              }
            }

            return res.status(500).json({
              success: false,
              error: "Failed to upload image",
              message: error.message || "Unknown error",
              details: error.response?.data || null,
            })
          }
        }
      } else {
        // Text-only post - use the SDK
        try {
          initFacebookSDK(page_access_token)
          const page = new Page(page_id)
          const postResponse = await page.createFeed([],{
            message: message,
            published: true,
          })

          // Return 200 OK with post ID
          return res.status(200).json({
            success: true,
            post_id: postResponse.id,
            content_type: "text",
            published: true,
            publish_time: new Date().toISOString(),
          })
        } catch (error: any) {
          console.error("Error creating text post:", error.message)
          if (error.response?.data) {
            console.error("Response data:", JSON.stringify(error.response.data, null, 2))
          }

          return res.status(500).json({
            success: false,
            error: "Failed to create text post",
            message: error.message || "Unknown error",
            details: error.response?.data || null,
          })
        }
      }
    }
  } catch (error: any) {
    console.error("Error scheduling post:", error.message)
    if (error.response?.data) {
      console.error("Response data:", JSON.stringify(error.response.data, null, 2))
    }

    // Return 500 Internal Server Error with error details
    return res.status(500).json({
      success: false,
      error: "Failed to schedule post",
      message: error.message || "Unknown error",
      details: error.response?.data || null,
    })
  }
}

// Function to schedule or post a reel to Facebook
export async function scheduleFacebookReel(req: any, res: any) {
  try {
    const { page_access_token, page_id, description, scheduled_time } = req.body
    const video = req.file

    // Validate required parameters
    if (!video || !page_access_token || !page_id || !description) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
        details: "Video file, Page ID, Access Token and Description are required.",
      })
    }

    // If scheduled_time is present, set up a cron job
    if (scheduled_time) {
      const scheduledDate = new Date(scheduled_time)

      // Validate the date is in the future
      if (scheduledDate <= new Date()) {
        return res.status(400).json({
          success: false,
          error: "Invalid scheduled time",
          details: "Scheduled time must be in the future",
        })
      }

      // Create a unique job ID
      const jobId = `reel_${page_id}_${Date.now()}`

      // Schedule the job
      const job = scheduleJob(scheduledDate, async () => {
        try {
          console.log(`Executing scheduled reel job ${jobId} at ${new Date()}`)

          // Upload the reel
          const reelResponse = await uploadReelToFacebook(video.path, page_id, page_access_token, description)

          console.log(
            `Successfully published scheduled reel ${jobId}, reel ID: ${reelResponse.id || reelResponse.post_id}`,
          )

          // Clean up video file
          try {
            fs.unlinkSync(video.path)
          } catch (unlinkError) {
            console.error(`Error deleting video file for job ${jobId}:`, unlinkError)
          }

          // Remove job from the map
          scheduledJobs.delete(jobId)
        } catch (jobError: any) {
          console.error(`Error executing scheduled reel job ${jobId}:`, jobError.message)
          if (jobError.response?.data) {
            console.error("Response data:", JSON.stringify(jobError.response.data, null, 2))
          }
        }
      })

      // Store the job in our map
      scheduledJobs.set(jobId, {
        job,
        videoPath: video.path,
        details: {
          type: "reel",
          page_id,
          description,
          scheduled_time: scheduledDate,
          video_size: fs.statSync(video.path).size,
          video_name: video.originalname || "unknown",
        },
      })
      await saveScheduledJob({
        job_id: jobId,
        type: "reel",
        page_id,
        description,
        scheduled_time: scheduledDate,
        has_media: true,
        media_type: "video",
        media_path: video.path,
      })


      // Calculate time remaining in seconds
      const timeRemaining = Math.floor((scheduledDate.getTime() - Date.now()) / 1000)

      // Return 201 Created with job ID and details
      return res.status(201).json({
        success: true,
        job_id: jobId,
        scheduled_time: scheduledDate.toISOString(),
        time_remaining: {
          seconds: timeRemaining,
          formatted: formatTimeRemaining(timeRemaining),
        },
        content_type: "reel",
        video_info: {
          name: video.originalname || "unknown",
          size: fs.statSync(video.path).size,
          type: video.mimetype,
        },
      })
    } else {
      // If no scheduled_time, post immediately
      try {
        // Upload the reel
        const reelResponse = await uploadReelToFacebook(video.path, page_id, page_access_token, description)

        // Clean up video file
        try {
          fs.unlinkSync(video.path)
        } catch (unlinkError) {
          console.error("Error deleting video file:", unlinkError)
        }

        // Return 200 OK with reel ID
        return res.status(200).json({
          success: true,
          reel_id: reelResponse.id || reelResponse.post_id,
          content_type: "reel",
          published: true,
          publish_time: new Date().toISOString(),
        })
      } catch (error: any) {
        console.error("Error uploading reel:", error.message)

        // Log detailed error information
        if (error.response) {
          console.error("Response status:", error.response.status)
          console.error("Response headers:", error.response.headers)
          console.error("Response data:", JSON.stringify(error.response.data, null, 2))
        } else if (error.request) {
          console.error("No response received, request:", error.request)
        } else {
          console.error("Error setting up request:", error.message)
        }

        // Clean up video file on error
        if (video.path) {
          try {
            fs.unlinkSync(video.path)
          } catch (unlinkError) {
            console.error("Error deleting video file:", unlinkError)
          }
        }

        return res.status(500).json({
          success: false,
          error: "Failed to upload reel",
          message: error.message || "Unknown error",
          details: error.response?.data || null,
        })
      }
    }
  } catch (error: any) {
    console.error("Error scheduling reel:", error.message)
    if (error.response?.data) {
      console.error("Response data:", JSON.stringify(error.response.data, null, 2))
    }

    // Clean up temporary file on error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path)
      } catch (e) {
        console.error("Failed to clean up temporary file:", e)
      }
    }

    // Return 500 Internal Server Error with error details
    return res.status(500).json({
      success: false,
      error: "Failed to schedule reel",
      message: error.message || "Unknown error",
      details: error.response?.data || null,
    })
  }
}

// Function to schedule or post a story to Facebook
export async function postFacebookStory(req: any, res: any) {
  try {
    const { page_access_token, page_id, scheduled_time } = req.body
    const media = req.file

    // Validate required parameters
    if (!media) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
        details: "Media file is required",
      })
    }

    if (!page_access_token || !page_id) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters",
        details: "Page ID and Access Token are required",
      })
    }

    // If scheduled_time is present, set up a cron job
    if (scheduled_time) {
      const scheduledDate = new Date(scheduled_time)

      // Validate the date is in the future
      if (scheduledDate <= new Date()) {
        return res.status(400).json({
          success: false,
          error: "Invalid scheduled time",
          details: "Scheduled time must be in the future",
        })
      }

      // Create a unique job ID
      const jobId = `story_${page_id}_${Date.now()}`

      // Schedule the job
      const job = scheduleJob(scheduledDate, async () => {
        try {
          console.log(`Executing scheduled story job ${jobId} at ${new Date()}`)

          // Post the story
          const storyResponse = await postStoryToFacebook(media.path, page_id, page_access_token, media.mimetype)

          console.log(`Successfully published scheduled story ${jobId}, story ID: ${storyResponse.id}`)

          // Clean up media file
          try {
            fs.unlinkSync(media.path)
          } catch (unlinkError) {
            console.error(`Error deleting media file for job ${jobId}:`, unlinkError)
          }

          // Remove job from the map
          scheduledJobs.delete(jobId)
        } catch (jobError: any) {
          console.error(`Error executing scheduled story job ${jobId}:`, jobError.message)
          if (jobError.response?.data) {
            console.error("Response data:", JSON.stringify(jobError.response.data, null, 2))
          }
        }
      })

      // Store the job in our map
      scheduledJobs.set(jobId, {
        job,
        mediaPath: media.path,
        details: {
          type: "story",
          page_id,
          media_type: media.mimetype,
          scheduled_time: scheduledDate,
          media_size: fs.statSync(media.path).size,
          media_name: media.originalname || "unknown",
        },
      })
      await saveScheduledJob({
        job_id: jobId,
        type: "story",
        page_id,
        scheduled_time: scheduledDate,
        has_media: true,
        media_type: media.mimetype,
        media_path: media.path,
      })

      // Calculate time remaining in seconds
      const timeRemaining = Math.floor((scheduledDate.getTime() - Date.now()) / 1000)

      // Return 201 Created with job ID and details
      return res.status(201).json({
        success: true,
        job_id: jobId,
        scheduled_time: scheduledDate.toISOString(),
        time_remaining: {
          seconds: timeRemaining,
          formatted: formatTimeRemaining(timeRemaining),
        },
        content_type: "story",
        media_info: {
          name: media.originalname || "unknown",
          size: fs.statSync(media.path).size,
          type: media.mimetype,
          is_video: media.mimetype.startsWith("video/"),
        },
      })
    } else {
      // If no scheduled_time, post immediately
      try {
        // Post the story
        const storyResponse = await postStoryToFacebook(media.path, page_id, page_access_token, media.mimetype)

        // Clean up media file
        try {
          fs.unlinkSync(media.path)
        } catch (unlinkError) {
          console.error("Error deleting media file:", unlinkError)
        }

        // Return 200 OK with story ID
        return res.status(200).json({
          success: true,
          story_id: storyResponse.id,
          content_type: "story",
          media_type: media.mimetype.startsWith("video/") ? "video" : "photo",
          published: true,
          publish_time: new Date().toISOString(),
        })
      } catch (error: any) {
        console.error("Error posting story:", error.message)

        // Log detailed error information
        if (error.response) {
          console.error("Response status:", error.response.status)
          console.error("Response headers:", error.response.headers)
          console.error("Response data:", JSON.stringify(error.response.data, null, 2))
        } else if (error.request) {
          console.error("No response received, request:", error.request)
        } else {
          console.error("Error setting up request:", error.message)
        }

        // Clean up media file on error
        if (media.path) {
          try {
            fs.unlinkSync(media.path)
          } catch (unlinkError) {
            console.error("Error deleting media file:", unlinkError)
          }
        }

        return res.status(500).json({
          success: false,
          error: "Failed to post story",
          message: error.message || "Unknown error",
          details: error.response?.data || null,
        })
      }
    }
  } catch (error: any) {
    console.error("Error posting story:", error.message)
    if (error.response?.data) {
      console.error("Response data:", JSON.stringify(error.response.data, null, 2))
    }

    // Clean up temporary file on error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path)
      } catch (e) {
        console.error("Failed to clean up temporary file:", e)
      }
    }

    // Return 500 Internal Server Error with error details
    return res.status(500).json({
      success: false,
      error: "Failed to post story",
      message: error.message || "Unknown error",
      details: error.response?.data || null,
    })
  }
}

// Get all scheduled jobs with improved response structure
export async function getScheduledJobs(req: any, res: any) {
  try {
    const dbJobs = await getAllScheduledJobs()

    if (!dbJobs || dbJobs.length === 0) {
      return res.status(204).end()
    }

    const now = Date.now()

    const jobs = dbJobs.map((job: any) => {
      const nextRunTime = new Date(job.scheduled_time)
      const timeRemaining = Math.floor((nextRunTime.getTime() - now) / 1000)

      return {
        job_id: job.job_id,
        type: job.type,
        status: job.status,
        details: {
          page_id: job.page_id,
          message: job.message,
          description: job.description,
          scheduled_time: nextRunTime,
          has_media: job.has_media,
          media_type: job.media_type,
          media_path: job.media_path,
        },
        next_run: nextRunTime.toISOString(),
        platform: "fb",
        time_remaining: {
          seconds: timeRemaining,
          formatted: formatTimeRemaining(timeRemaining),
        },
        has_media: job.has_media,
      }
    })

    // Sort jobs by next run time (soonest first)
    jobs.sort((a, b) => new Date(a.next_run).getTime() - new Date(b.next_run).getTime())

    // Group jobs by type for easier frontend organization
    const groupedJobs = {
      posts: jobs.filter((job) => job.type === "post"),
      reels: jobs.filter((job) => job.type === "reel"),
      stories: jobs.filter((job) => job.type === "story"),
    }

    return res.status(200).json({
      success: true,
      count: jobs.length,
      jobs,
      grouped: groupedJobs,
    })
  } catch (error: any) {
    console.error("Error getting scheduled jobs from DB:", error)

    return res.status(500).json({
      success: false,
      error: "Failed to get scheduled jobs",
      message: error.message || "Unknown error",
    })
  }
}


// your in-memory scheduledJobs map is still needed to cancel active jobs
export async function cancelScheduledJob(req: any, res: any) {
  try {
    const { job_id } = req.body

    if (!job_id) {
      return res.status(400).json({
        success: false,
        error: "Missing job_id parameter",
      })
    }

    let wasInMemory = false

    if (scheduledJobs.has(job_id)) {
      const jobData = scheduledJobs.get(job_id)

      // Cancel the job
      jobData.job.cancel()
      wasInMemory = true

      // Clean up media
      if (jobData.mediaPath) {
        try {
          fs.unlinkSync(jobData.mediaPath)
        } catch (e) {
          console.error(`Failed to clean up media file for job ${job_id}:`, e)
        }
      }

      if (jobData.videoPath) {
        try {
          fs.unlinkSync(jobData.videoPath)
        } catch (e) {
          console.error(`Failed to clean up video file for job ${job_id}:`, e)
        }
      }

      // Remove from memory
      scheduledJobs.delete(job_id)
    }

    // Mark as cancelled in DB
    await updateJobStatus(job_id, "cancelled")

    return res.status(200).json({
      success: true,
      message: `Job ${job_id} cancelled successfully`,
      job_id: job_id,
      in_memory: wasInMemory,
    })
  } catch (error: any) {
    console.error("Error cancelling scheduled job:", error)

    return res.status(500).json({
      success: false,
      error: "Failed to cancel scheduled job",
      message: error.message || "Unknown error",
    })
  }
}


