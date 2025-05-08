import type { Request, Response } from "express";
import { fetchInstagramProfile } from "../../services/monitoring/instagram.service";
import type { InstagramPost } from "../../types/index";
import { getClient, query } from "../../config/db.config";
import { rdb } from "../../config/rdb.config";

// addUser function
export const addUser = async (req: Request, res: Response): Promise<void> => {
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

  try {
    // Check if user already exists for this user_id
    const existingUser = await query(
      "SELECT id FROM automation_users_ig WHERE username = $1 AND user_id = $2",
      [username, userId]
    );

    if (existingUser.rows.length > 0) {
      res
        .status(409)
        .json({ error: "Username already exists in your automation list" });
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

      // Add to automation users
      await client.query(
        "INSERT INTO automation_users_ig (username, user_id) VALUES ($1, $2)",
        [username, userId]
      );

      // Add user data
      await client.query(
        `INSERT INTO user_data_ig (
          username, user_id, full_name, biography, profile_pic_url, is_private, is_verified,
          followers, following, posts_count, external_url, engagement_rate, recent_posts, total_likes, total_comments, price_per_post, stats
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (username) DO NOTHING;`,
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