import type { Request, Response } from "express"
import pool from "../../config/db.config" // For PostgreSQL
import { query } from "../../config/db.config" // Assuming query and pool are both available
import { UserSettings } from "../../types/settings"

export const getUserProfileData = async (req: Request, res: Response) => {
  const username = req.body?.username
    console.log("username", username)
  if (!username) {
     res.status(400).json({ message: "Missing userId in request body" })
     return
  }

  try {
    const user = await query(
      `SELECT * FROM users WHERE unique_username = $1`,
        [username]
    )

    const userId = user.rows[0]?.id
    if(!userId){
     res.status(400).json({ message: "Missing userId in request body" })
        return
    }
    console.log(userId,"userId")
    // 1. Get or Create Settings
    const settingsResult = await query(`SELECT * FROM user_settings WHERE user_id = $1`, [userId])

    console.log(settingsResult.rows,"settingsResult")

    let settingsRow
    if (settingsResult.rows.length === 0) {
      const defaultSettings = await query(
        `INSERT INTO user_settings (user_id) VALUES ($1) RETURNING *`,
        [userId]
      )
      settingsRow = defaultSettings.rows[0]
    } else {
      settingsRow = settingsResult.rows[0]
    }

    const settings = transformSettingsFromDb(settingsRow)

    // 2. Get Regular Links
    const regularLinksResult = await pool.query(
      `SELECT * FROM regular_links WHERE user_id = $1`,
      [userId]
    )
    const regularLinks = regularLinksResult.rows

    // 3. Get Social Links
    const socialLinksResult = await query(
      `SELECT * FROM social_links WHERE user_id = $1`,
      [userId]
    )
    const socialLinks = socialLinksResult.rows

    // 4. Return All Data Together
    res.status(200).json({
      settings,
      regularLinks,
      socialLinks,
    })
  } catch (error) {
    console.error("Error fetching user profile data:", error)
     res.status(500).json({ message: "Internal server error" })

  }
}

function transformSettingsFromDb(dbSettings: any): UserSettings {
  return {
    id: dbSettings.id,
    userId: dbSettings.user_id,
    displayName: dbSettings.display_name || "",
    username: dbSettings.username || "",
    bio: dbSettings.bio || "",
    website: dbSettings.website || "",
    profileImage: dbSettings.profile_image,
    twoFactorEnabled: dbSettings.two_factor_enabled || false,
    theme: dbSettings.theme || "light",
    appearancePreferences: dbSettings.appearance_preferences,
    themeSettings: dbSettings.theme_settings,
    notificationPreferences: dbSettings.notification_preferences,
    createdAt: dbSettings.created_at,
    updatedAt: dbSettings.updated_at,
  }
}