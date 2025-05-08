import axios from "axios";
import { Request, Response } from "express";
import schedule from "node-schedule";
import { query } from "../../../config/db.config";

// Helper: Wait for REELS to be processed
const waitForMediaReady = async (
  creationId: string,
  accessToken: string,
  retries = 10,
  delayMs = 2000
): Promise<boolean> => {
  for (let i = 0; i < retries; i++) {
    const res = await axios.get(`https://graph.facebook.com/v22.0/${creationId}`, {
      params: {
        fields: "status_code",
        access_token: accessToken,
      },
    });

    const status = res.data.status_code;
    if (status === "FINISHED") return true;
    if (status === "ERROR") break;

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return false;
};

// DB insert + job scheduler
const saveAndScheduleJob = async (
  ig_user_id: string,
  creation_id: string,
  access_token: string,
  scheduled_time: string,
  type: string,
  user_id:string
) => {
  await query(
    `INSERT INTO scheduled_posts_ig (ig_user_id, creation_id, access_token, scheduled_time, type, user_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [ig_user_id, creation_id, access_token, scheduled_time, type, user_id]
  );

  schedule.scheduleJob(`job_${creation_id}`, new Date(scheduled_time), async () => {
    try {
      await axios.post(
        `https://graph.facebook.com/v22.0/${ig_user_id}/media_publish`,
        null,
        {
          params: {
            creation_id,
            access_token
          }
        }
      );

      await query(
        `UPDATE scheduled_posts_ig SET published = true, published_at = NOW() WHERE creation_id = $1`,
        [creation_id]
      );

      console.log(`✅ Published scheduled ${type} for IG user ${ig_user_id}`);
    } catch (err: any) {
      console.error(`❌ Failed to publish ${creation_id}:`, err.response?.data || err.message);
    }
  });
};

export const scheduleSinglePost = async (req: Request, res: Response) => {
  const {
    ig_user_id,
    access_token,
    caption,
    alt_text,
    image_url,
    video_url,
    type = "post",
    scheduled_publish_time,
    user_id
  } = req.body;

  if (!ig_user_id || !access_token || (!image_url && !video_url)) {
     res.status(400).json({ error: "Missing required fields." });
     return
  }

  try {
    const params: any = {
      access_token,
      caption: caption || "",
      alt_text: alt_text || ""
    };

    if (type === "reel") {
      params.video_url = video_url;
      params.media_type = "REELS";
    } else if (type === "story") {
      params.media_type = "STORIES";
      params[video_url ? "video_url" : "image_url"] = video_url || image_url;
      params.is_stories = true;
    } else {
      params[video_url ? "video_url" : "image_url"] = video_url || image_url;
    }

    // Step 1: Create the container
    const containerRes = await axios.post(
      `https://graph.facebook.com/v22.0/${ig_user_id}/media`,
      null,
      { params }
    );

    const creationId = containerRes.data.id;

    // Step 2: Wait for reels to be ready
    if (type === "reel") {
      const ready = await waitForMediaReady(creationId, access_token);
      if (!ready) {
         res.status(400).json({
          error: "Media is not ready after multiple retries. Try again later.",
        });
        return
      }
    }

    const now = new Date();
    const scheduledTime = scheduled_publish_time ? new Date(scheduled_publish_time) : now;

    if (scheduledTime > now && type !== "story") {
      // Schedule it
      await saveAndScheduleJob(ig_user_id, creationId, access_token, scheduled_publish_time, type, user_id);

       res.status(200).json({
        success: true,
        message: `Media container created and scheduled for publishing`,
        container_id: creationId,
      });
      return
    } else {
      // Publish immediately
      const publishRes = await axios.post(
        `https://graph.facebook.com/v22.0/${ig_user_id}/media_publish`,
        null,
        {
          params: {
            creation_id: creationId,
            access_token
          }
        }
      );

       res.status(200).json({
        success: true,
        creationId,
        publishResult: publishRes.data
      });
      return
    }
  } catch (err: any) {
    console.error("Error scheduling post:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
};


export const getScheduledPosts = async (req: Request, res: Response) => {
    const { userId } = req.body;
  
    if (!userId) {
       res.status(400).json({ error: "Missing userId in request body." });
       return
    }
  
    try {
      const result = await query(
        `SELECT 
           id,
           ig_user_id,
           creation_id,
           type,
           scheduled_time,
           published,
           published_at,
           created_at
         FROM scheduled_posts
         WHERE user_id = $1
         ORDER BY scheduled_time DESC`,
        [userId]
      );
  
       res.status(200).json({
        success: true,
        count: result.rows.length,
        jobs: result.rows,
      });
      return
    } catch (err: any) {
      console.error("Error fetching scheduled jobs:", err.message);
       res.status(500).json({ error: "Failed to fetch scheduled posts." });
       return
    }
  };