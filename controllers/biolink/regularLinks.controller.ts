import type { Request, Response } from "express"
import pool from "../../config/db.config"

// GET all regular links for a user
export const getRegularLinks = async (req: Request, res: Response) => {
  const userId = req.user?.userId

  if (!userId) {res.status(401).json({ message: "Unauthorized" })
    return
}

  try {
    const result = await pool.query(
      `SELECT * FROM regular_links WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    )

    console.log('res', result.rows)
    res.status(200).json(result.rows)
  } catch (err) {
    console.error("Error fetching regular links:", err)
    res.status(500).json({ message: "Internal server error" })
  }
}

// REPLACE all regular links (batch update)
export const updateRegularLinks = async (req: Request, res: Response) => {
    const userId = req.user?.userId
    const links = req.body.links
  
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" })
      return
    }
  
    if (!Array.isArray(links)) {
      res.status(400).json({ message: "Invalid links array" })
      return
    }
  
    try {
      // Remove old links
      await pool.query(`DELETE FROM regular_links WHERE user_id = $1`, [userId])
  
      // Insert new links (parameterized)
      for (const link of links) {
        const {
          title,
          url,
          active,
          clicks = 0,
          favorite = false,
          thumbnail,
          layout,
          scheduledDate,
          scheduleStart,
          scheduleEnd,
          timezone,
        } = link
        
        await pool.query(
          `
          INSERT INTO regular_links (
            user_id, title, url, active, clicks, favorite, thumbnail,
            layout, scheduled_date, schedule_start, schedule_end, timezone
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `,
          [
            userId,
            title,
            url,
            active,
            clicks,
            favorite,
            thumbnail || null,
            layout || null,
            scheduledDate || null,
            scheduleStart || null,
            scheduleEnd || null,
            timezone || null,
          ]
        )
      }
      console.log("Regular Links Updated")
      res.status(200).json({ message: "Regular links updated successfully" })
    } catch (err) {
      console.error("Error updating regular links:", err)
      res.status(500).json({ message: "Internal server error" })
    }
  }
  