import type { Request, Response } from "express";
import { fetchTiktokProfile } from "../../services/monitoring/tiktok.service";
import { getClient, query } from "../../config/db.config";
import { rdb } from "../../config/rdb.config";

// Add a new TikTok user to monitor
export const addUser = async (req: Request, res: Response): Promise<void> => {
  const { username } = req.body;
  const userId = req.user?.userId; // Get userId from authenticated request

  if (!username) {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    // Check if user already exists for this user_id
    const existingUser = await query(
      "SELECT id FROM monitored_users_tiktok WHERE username = $1 AND user_id = $2",
      [username, userId]
    );

    if (existingUser.rows.length > 0) {
      res
        .status(409)
        .json({ error: "Username already exists in your monitored list" });
      return;
    }

    // Fetch TikTok profile data
    const data = await fetchTiktokProfile(username);

    if (!data) {
      res
        .status(400)
        .json({ error: "Invalid username or unable to fetch data" });
      return;
    }

    // Get client for transaction
    const { client, done } = await getClient();

    try {
      // Begin transaction
      await client.query("BEGIN");

      // Add to monitored users
      await client.query(
        "INSERT INTO monitored_users_tiktok (username, user_id) VALUES ($1, $2)",
        [username, userId]
      );

      // Add user data
      await client.query(
        `INSERT INTO user_data_tiktok (
          username, user_id, full_name, profile_pic_url, bio, followers, following,
          likes, videos, is_verified, recent_videos, total_likes, total_comments,
          total_shares, total_views, engagement_rate, stats
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          data.username,
          userId,
          data.full_name,
          data.profile_pic_url,
          data.bio,
          data.followers,
          data.following,
          data.likes,
          data.videos,
          data.is_verified,
          JSON.stringify(data.recent_videos),
          data.total_likes,
          data.total_comments,
          data.total_shares,
          data.total_views,
          data.engagement_rate,
          JSON.stringify(data.stats),
        ]
      );

      // Commit transaction
      await client.query("COMMIT");

      res.status(201).json({ message: "User added successfully" });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error adding user:", error);
      res.status(500).json({ error: "Internal server error" });
    } finally {
      done();
    }
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Remove a TikTok user from monitoring
export const removeUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { username } = req.body;
  const userId = req.user?.userId;

  if (!username) {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { client, done } = await getClient();

  try {
    await client.query("BEGIN");

    // Delete from monitored users
    await client.query(
      "DELETE FROM monitored_users_tiktok WHERE username = $1 AND user_id = $2",
      [username, userId]
    );

    // Delete user data
    await client.query(
      "DELETE FROM user_data_tiktok WHERE username = $1 AND user_id = $2",
      [username, userId]
    );

    await client.query("COMMIT");

    res.status(200).json({ message: `User ${username} removed successfully` });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error removing user:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    done();
  }
};

// Refresh TikTok data for all monitored users
export const refreshData = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const cacheKey = `monitored_users_tiktok:${userId}`;

    // Get all monitored users for this user_id
    const result = await query(
      "SELECT username FROM monitored_users_tiktok WHERE user_id = $1",
      [userId]
    );

    const usernames = result.rows.map((row) => row.username);
    const updates: string[] = [];

    // Process each user sequentially to avoid rate limiting
    for (const username of usernames) {
      try {
        const data = await fetchTiktokProfile(username);

        if (!data) {
          updates.push(`Failed to fetch data for ${username}`);
          continue;
        }

        // Get last entry for comparison
        const lastEntryResult = await query(
          `SELECT followers, following, likes, videos, recent_videos
           FROM user_data_tiktok 
           WHERE username = $1 AND user_id = $2 
           ORDER BY timestamp DESC LIMIT 1`,
          [username, userId]
        );

        const lastEntry = lastEntryResult.rows[0];
        let shouldUpdate = false;

        if (lastEntry) {
          const lastVideos =
            typeof lastEntry.recent_videos === "string"
              ? JSON.parse(lastEntry.recent_videos)
              : lastEntry.recent_videos || [];

          // Check if any video data has changed
          for (const newVideo of data.recent_videos) {
            const matchedVideo = lastVideos.find(
              (video: any) => video.video_id === newVideo.video_id
            );

            if (
              matchedVideo &&
              (matchedVideo.likes !== newVideo.likes ||
                matchedVideo.comments !== newVideo.comments ||
                matchedVideo.shares !== newVideo.shares ||
                matchedVideo.views !== newVideo.views)
            ) {
              shouldUpdate = true;
              break;
            }
          }

          // Check if profile metrics have changed
          if (
            data.followers !== lastEntry.followers ||
            data.following !== lastEntry.following ||
            data.likes !== lastEntry.likes ||
            data.videos !== lastEntry.videos
          ) {
            shouldUpdate = true;
          }
        } else {
          // No previous entry, should update
          shouldUpdate = true;
        }

        if (shouldUpdate) {
          await query(
            `INSERT INTO user_data_tiktok (
              username, user_id, full_name, profile_pic_url, bio, followers, following,
              likes, videos, is_verified, recent_videos, total_likes, total_comments,
              total_shares, total_views, engagement_rate, stats
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
            [
              data.username,
              userId,
              data.full_name,
              data.profile_pic_url,
              data.bio,
              data.followers,
              data.following,
              data.likes,
              data.videos,
              data.is_verified,
              JSON.stringify(data.recent_videos),
              data.total_likes,
              data.total_comments,
              data.total_shares,
              data.total_views,
              data.engagement_rate,
              JSON.stringify(data.stats),
            ]
          );

          updates.push(`Updated data for ${username}`);
        } else {
          updates.push(`No changes detected for ${username}`);
        }
      } catch (error) {
        updates.push(
          `Error updating ${username}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    await rdb.set(cacheKey, JSON.stringify(updates), 300);
    res.status(200).json({ updates });
  } catch (error) {
    console.error("Error refreshing data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const refreshAllData = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const cacheKey = `monitored_users_tiktok`;

    // Get all monitored users for all users
    const result = await query(
      "SELECT user_id, username FROM monitored_users_tiktok"
    );

    const updates: string[] = [];

    // Process each user sequentially to avoid rate limiting
    for (const row of result.rows) {
      const { user_id: userId, username } = row;

      try {
        const data = await fetchTiktokProfile(username);

        if (!data) {
          updates.push(`Failed to fetch data for ${username}`);
          continue;
        }

        // Get last entry for comparison
        const lastEntryResult = await query(
          `SELECT followers, following, likes, videos, recent_videos
             FROM user_data_tiktok 
             WHERE username = $1 AND user_id = $2 
             ORDER BY timestamp DESC LIMIT 1`,
          [username, userId]
        );

        const lastEntry = lastEntryResult.rows[0];
        let shouldUpdate = false;

        if (lastEntry) {
          const lastVideos =
            typeof lastEntry.recent_videos === "string"
              ? JSON.parse(lastEntry.recent_videos)
              : lastEntry.recent_videos || [];

          // Check if any video data has changed
          for (const newVideo of data.recent_videos) {
            const matchedVideo = lastVideos.find(
              (video: any) => video.video_id === newVideo.video_id
            );

            if (
              matchedVideo &&
              (matchedVideo.likes !== newVideo.likes ||
                matchedVideo.comments !== newVideo.comments ||
                matchedVideo.shares !== newVideo.shares ||
                matchedVideo.views !== newVideo.views)
            ) {
              shouldUpdate = true;
              break;
            }
          }

          // Check if profile metrics have changed
          if (
            data.followers !== lastEntry.followers ||
            data.following !== lastEntry.following ||
            data.likes !== lastEntry.likes ||
            data.videos !== lastEntry.videos
          ) {
            shouldUpdate = true;
          }
        } else {
          // No previous entry, should update
          shouldUpdate = true;
        }

        if (shouldUpdate) {
          await query(
            `INSERT INTO user_data_tiktok (
                username, user_id, full_name, profile_pic_url, bio, followers, following,
                likes, videos, is_verified, recent_videos, total_likes, total_comments,
                total_shares, total_views, engagement_rate, stats
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
            [
              data.username,
              userId,
              data.full_name,
              data.profile_pic_url,
              data.bio,
              data.followers,
              data.following,
              data.likes,
              data.videos,
              data.is_verified,
              JSON.stringify(data.recent_videos),
              data.total_likes,
              data.total_comments,
              data.total_shares,
              data.total_views,
              data.engagement_rate,
              JSON.stringify(data.stats),
            ]
          );

          updates.push(`Updated data for ${username} (User ID: ${userId})`);
        } else {
          updates.push(
            `No changes detected for ${username} (User ID: ${userId})`
          );
        }
      } catch (error) {
        updates.push(
          `Error updating ${username}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    await rdb.set(cacheKey, JSON.stringify(updates), 300);
    res.status(200).json({ updates });
  } catch (error) {
    console.error("Error refreshing all data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get data for a specific TikTok user
export const getData = async (req: Request, res: Response): Promise<void> => {
  const { username } = req.query;
  const userId = req.user?.userId;

  if (!username) {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const cacheKey = `user_data_tiktok:${userId}`;

    const cached = await rdb.get(cacheKey);
    if (cached) {
      res.status(200).json({ data: JSON.parse(cached) });
      return;
    }
    const result = await query(
      `SELECT username, full_name, profile_pic_url, bio, followers, following, 
       likes, videos, is_verified, recent_videos, total_likes, total_comments,
       total_shares, total_views, engagement_rate, timestamp, stats
       FROM user_data_tiktok 
       WHERE username = $1 AND user_id = $2 
       ORDER BY timestamp DESC LIMIT 5`,
      [username, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "No data found" });
      return;
    }

    const data = result.rows.map((row) => ({
      username: row.username,
      full_name: row.full_name,
      profile_pic_url: row.profile_pic_url,
      bio: row.bio,
      followers: row.followers,
      following: row.following,
      likes: row.likes,
      videos: row.videos,
      is_verified: row.is_verified,
      recent_videos:
        typeof row.recent_videos === "string"
          ? JSON.parse(row.recent_videos)
          : row.recent_videos,
      total_likes: row.total_likes,
      total_comments: row.total_comments,
      total_shares: row.total_shares,
      total_views: row.total_views,
      engagement_rate: row.engagement_rate,
      timestamp: row.timestamp.toISOString(),
      stats: typeof row.stats === "string" ? JSON.parse(row.stats) : row.stats,
    }));

    await rdb.set(cacheKey, JSON.stringify(data), 300);
    res.status(200).json({ data });
  } catch (error) {
    console.error("Error getting data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all monitored TikTok users
export const getAllUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const cacheKey = `monitored_users_tiktok:${userId}`;

    const cached = await rdb.get(cacheKey);
    if (cached) {
      res.status(200).json({ users: JSON.parse(cached) });
      return;
    }
    const result = await query(
      "SELECT username FROM monitored_users_tiktok WHERE user_id = $1",
      [userId]
    );

    const users = result.rows.map((row) => row.username);

    await rdb.set(cacheKey, JSON.stringify(users), 300);
    res.status(200).json({ users });
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
