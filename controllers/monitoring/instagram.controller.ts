import type { Request, Response } from "express";
import { fetchInstagramProfile } from "../../services/monitoring/instagram.service";
import type { InstagramPost } from "../../types";
import { getClient, query } from "../../config/db.config";
import { rdb } from "../../config/rdb.config";

// Update the controller to use the new database client approach

// Replace the addUser function
export const addUser = async (req: Request, res: Response): Promise<void> => {
  const { username } = req.body;
  const userId = req.user?.userId; // Assuming user authentication middleware sets req.user

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
      "SELECT id FROM monitored_users_ig WHERE username = $1 AND user_id = $2",
      [username, userId]
    );

    if (existingUser.rows.length > 0) {
      res
        .status(409)
        .json({ error: "Username already exists in your monitored list" });
      return;
    }

    // Fetch Instagram profile data
    const data = await fetchInstagramProfile(username);

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
        "INSERT INTO monitored_users_ig (username, user_id) VALUES ($1, $2)",
        [username, userId]
      );

      // Add user data
      await client.query(
        `INSERT INTO user_data_ig (
          username, user_id, full_name, biography, profile_pic_url, is_private, is_verified,
          followers, following, posts_count, external_url, engagement_rate, recent_posts, total_likes, total_comments, price_per_post, stats
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
          data.username,
          userId,
          data.full_name,
          data.biography,
          data.profile_pic_url,
          data.is_private,
          data.is_verified,
          data.followers,
          data.following,
          data.posts_count,
          data.external_url,
          data.engagement_rate,
          JSON.stringify(data.recent_posts),
          data.total_likes,
          data.total_comments,
          data.price_per_post,
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

// Replace the removeUser function
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
      "DELETE FROM monitored_users_ig WHERE username = $1 AND user_id = $2",
      [username, userId]
    );

    // Delete user data
    await client.query(
      "DELETE FROM user_data_ig WHERE username = $1 AND user_id = $2",
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

// Replace the refreshData function
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
    const cacheKey = `monitored_users_ig:${userId}`;

    // Get all monitored users for this user_id
    const result = await query(
      "SELECT username FROM monitored_users_ig WHERE user_id = $1",
      [userId]
    );

    const usernames = result.rows.map((row: any) => row.username);
    const updates: string[] = [];

    // Process each user sequentially to avoid rate limiting
    for (const username of usernames) {
      try {
        const data = await fetchInstagramProfile(username);

        if (!data) {
          updates.push(`Failed to fetch data for ${username}`);
          continue;
        }

        // Get last entry for comparison
        const lastEntryResult = await query(
          `SELECT followers, following, posts_count, engagement_rate, recent_posts
           FROM user_data_ig 
           WHERE username = $1 AND user_id = $2 
           ORDER BY timestamp DESC LIMIT 1`,
          [username, userId]
        );

        const lastEntry = lastEntryResult.rows[0];
        let shouldUpdate = false;

        if (lastEntry) {
          const lastPosts: InstagramPost[] =
            typeof lastEntry.recent_posts === "string"
              ? JSON.parse(lastEntry.recent_posts)
              : lastEntry.recent_posts || [];

          // Check if any post data has changed
          for (const newPost of data.recent_posts) {
            const matchedPost = lastPosts.find(
              (post) => post.post_id === newPost.post_id
            );

            if (
              matchedPost &&
              (matchedPost.likes !== newPost.likes ||
                matchedPost.comments !== newPost.comments ||
                matchedPost.video_view_count !== newPost.video_view_count)
            ) {
              shouldUpdate = true;
              break;
            }
          }

          // Check if profile metrics have changed
          if (
            data.followers !== lastEntry.followers ||
            data.following !== lastEntry.following ||
            data.posts_count !== lastEntry.posts_count ||
            data.engagement_rate !== lastEntry.engagement_rate
          ) {
            shouldUpdate = true;
          }
        } else {
          // No previous entry, should update
          shouldUpdate = true;
        }

        if (shouldUpdate) {
          await query(
            `INSERT INTO user_data_ig (
              username, user_id, full_name, biography, profile_pic_url, is_private, is_verified,
              followers, following, posts_count, external_url, engagement_rate, recent_posts, total_likes, total_comments, price_per_post, stats
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
            [
              data.username,
              userId,
              data.full_name,
              data.biography,
              data.profile_pic_url,
              data.is_private,
              data.is_verified,
              data.followers,
              data.following,
              data.posts_count,
              data.external_url,
              data.engagement_rate,
              JSON.stringify(data.recent_posts),
              data.total_likes,
              data.total_comments,
              data.price_per_post,
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

    await rdb.set(cacheKey, JSON.stringify(usernames), 300);
    res.status(200).json({ updates });
  } catch (error) {
    console.error("Error refreshing data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const refreshAllIGData = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const cacheKey = `monitored_users_ig`;

    const result = await query(
      "SELECT user_id, username FROM monitored_users_ig"
    );
    const entries = result.rows;

    const updates: string[] = [];

    for (const { user_id: userId, username } of entries) {
      try {
        const data = await fetchInstagramProfile(username);

        if (!data) {
          updates.push(`Failed to fetch data for ${username}`);
          continue;
        }

        const lastEntryResult = await query(
          `SELECT followers, following, posts_count, engagement_rate, recent_posts
             FROM user_data_ig 
             WHERE username = $1 AND user_id = $2 
             ORDER BY timestamp DESC LIMIT 1`,
          [username, userId]
        );

        const lastEntry = lastEntryResult.rows[0];
        let shouldUpdate = false;

        if (lastEntry) {
          const lastPosts: InstagramPost[] =
            typeof lastEntry.recent_posts === "string"
              ? JSON.parse(lastEntry.recent_posts)
              : lastEntry.recent_posts || [];

          for (const newPost of data.recent_posts) {
            const matchedPost = lastPosts.find(
              (post) => post.post_id === newPost.post_id
            );

            if (
              matchedPost &&
              (matchedPost.likes !== newPost.likes ||
                matchedPost.comments !== newPost.comments ||
                matchedPost.video_view_count !== newPost.video_view_count)
            ) {
              shouldUpdate = true;
              break;
            }
          }

          if (
            data.followers !== lastEntry.followers ||
            data.following !== lastEntry.following ||
            data.posts_count !== lastEntry.posts_count ||
            data.engagement_rate !== lastEntry.engagement_rate
          ) {
            shouldUpdate = true;
          }
        } else {
          shouldUpdate = true;
        }

        if (shouldUpdate) {
          await query(
            `INSERT INTO user_data_ig (
                username, user_id, full_name, biography, profile_pic_url, is_private, is_verified,
                followers, following, posts_count, external_url, engagement_rate, recent_posts, total_likes, total_comments, price_per_post, stats
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
            [
              data.username,
              userId,
              data.full_name,
              data.biography,
              data.profile_pic_url,
              data.is_private,
              data.is_verified,
              data.followers,
              data.following,
              data.posts_count,
              data.external_url,
              data.engagement_rate,
              JSON.stringify(data.recent_posts),
              data.total_likes,
              data.total_comments,
              data.price_per_post,
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
    console.error("Error refreshing all IG data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Replace the getData function
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
    const cacheKey = `user_data_ig:${userId}`;

    const cached = await rdb.get(cacheKey);
    if (cached) {
      res.status(200).json({ data: JSON.parse(cached) });
      return;
    }

    const result = await query(
      `SELECT username, followers, following, posts_count, engagement_rate, recent_posts, timestamp, total_likes, total_comments, price_per_post, stats
       FROM user_data_ig 
       WHERE username = $1 AND user_id = $2 
       ORDER BY timestamp DESC LIMIT 5`,
      [username, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "No data found" });
      return;
    }

    const data = result.rows.map((row: any) => ({
      username: row.username,
      followers: row.followers,
      following: row.following,
      posts_count: row.posts_count,
      engagement_rate: row.engagement_rate,
      recent_posts:
        typeof row.recent_posts === "string"
          ? JSON.parse(row.recent_posts)
          : row.recent_posts,
      timestamp: row.timestamp.toISOString(),
      total_likes: row.total_likes,
      total_comments: row.total_comments,
      price_per_post: row.price_per_post,
      stats: typeof row.stats === "string" ? JSON.parse(row.stats) : row.stats,
    }));

    await rdb.set(cacheKey, JSON.stringify(data), 300);
    res.status(200).json({ data });
  } catch (error) {
    console.error("Error getting data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Replace the getAllUsers function
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
    const cacheKey = `monitored_users_ig:${userId}`;

    const cached = await rdb.get(cacheKey);
    if (cached) {
      res.status(200).json({ users: JSON.parse(cached) });
      return;
    }

    const result = await query(
      "SELECT username FROM monitored_users_ig WHERE user_id = $1",
      [userId]
    );

    const users = result.rows.map((row: any) => row.username);
    
    await rdb.set(cacheKey, JSON.stringify(users), 300);
    res.status(200).json({ users });
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
