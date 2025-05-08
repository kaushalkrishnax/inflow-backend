import type { Request, Response } from "express"
import { query } from "../../config/db.config"
import type { UserSettings, UpdateSettingsRequest } from "../../types/settings"

// Get user settings
export const getUserSettings = async (req: Request, res: Response) => {
  try {
    // Get user ID from authenticated request
    const userId = req.user?.userId

    if (!userId) {
         res.status(401).json({ message: "Unauthorized" })
         return
    }
    console.log(userId,"userId")
    // Query database for user settings
    const result = await query(`SELECT * FROM user_settings WHERE user_id = $1`, [userId])

    // If no settings found, create default settings
    if (result.rows.length === 0) {
      // Insert default settings
      const defaultSettings = await query(
        `INSERT INTO user_settings (user_id) 
         VALUES ($1) 
         RETURNING *`,
        [userId],
      )

      // Transform database column names to camelCase for frontend
      const settings = transformSettingsFromDb(defaultSettings.rows[0])
       res.status(200).json(settings)
       return
    }

    const users = await query(`SELECT * FROM users WHERE id = $1`, [userId])
    const vals = users.rows[0]
    // Transform database column names to camelCase for frontend
    const settings = transformSettingsFromDb(result.rows[0])
    console.log(settings)
    res.status(200).json({...settings, displayName:vals.username, username:vals.unique_username, is_paid:vals.is_paid})
    return
  } catch (error) {
    console.error("Error fetching user settings:", error)
    res.status(500).json({ message: "Internal server error" })
    return
  }
}

// Update user settings
export const updateUserSettings = async (req: Request, res: Response) => {
  try {
    // Get user ID from authenticated request
    const userId = req.user?.userId

    if (!userId) {
       res.status(401).json({ message: "Unauthorized" })
       return
    }

    const updates: UpdateSettingsRequest = req.body
    console.log("updates",updates)
    // Check if settings exist for this user
    const checkResult = await query(`SELECT id FROM user_settings WHERE user_id = $1`, [userId])

    let settingsId: string

    if (checkResult.rows.length === 0) {
      // Create new settings record if none exists
      const newSettings = await query(
        `INSERT INTO user_settings (user_id) 
         VALUES ($1) 
         RETURNING id`,
        [userId],
      )
      settingsId = newSettings.rows[0].id
    } else {
      settingsId = checkResult.rows[0].id
    }

    // Build the update query dynamically based on provided fields
    const updateFields: string[] = []
    const queryParams: any[] = []
    let paramIndex = 1

    // Handle simple string/boolean fields
    const simpleFields = [
      { key: "displayName", column: "display_name" },
      { key: "username", column: "username" },
      { key: "bio", column: "bio" },
      { key: "website", column: "website" },
      { key: "profileImage", column: "profile_image" },
      { key: "twoFactorEnabled", column: "two_factor_enabled" },
      { key: "theme", column: "theme" },
    ]

    simpleFields.forEach(({ key, column }) => {
      if (updates[key as keyof UpdateSettingsRequest] !== undefined) {
        updateFields.push(`${column} = $${paramIndex}`)
        queryParams.push(updates[key as keyof UpdateSettingsRequest])
        paramIndex++
      }
    })

    // Handle JSON fields with partial updates
    const jsonFields = [
      { key: "appearancePreferences", column: "appearance_preferences" },
      { key: "themeSettings", column: "theme_settings" },
      { key: "notificationPreferences", column: "notification_preferences" },
    ]

    for (const { key, column } of jsonFields) {
      const updateKey = key as keyof UpdateSettingsRequest
      if (updates[updateKey]) {
        // Get current JSON value
        const currentResult = await query(`SELECT ${column} FROM user_settings WHERE id = $1`, [settingsId])

        const currentValue = currentResult.rows[0][column]

        // Merge with updates
        const updatedValue = {
          ...(typeof currentValue === "object" && currentValue !== null ? currentValue : {}),
          ...(typeof updates[updateKey] === "object" && updates[updateKey] !== null ? updates[updateKey] : {}),
        }

        updateFields.push(`${column} = $${paramIndex}`)
        queryParams.push(updatedValue)
        paramIndex++
      }
    }

    // If no fields to update, return current settings
    if (updateFields.length === 0) {
       res.status(400).json({ message: "No valid fields to update" })
       return
    }

    // Add settingsId as the last parameter
    queryParams.push(settingsId)

    // Execute update query
    const updateQuery = `
      UPDATE user_settings 
      SET ${updateFields.join(", ")} 
      WHERE id = $${paramIndex} 
      RETURNING *
    `

    const result = await query(updateQuery, queryParams)

    // Transform database column names to camelCase for frontend
    const updatedSettings = transformSettingsFromDb(result.rows[0])
     res.status(200).json(updatedSettings)
     return
  } catch (error) {
    console.error("Error updating user settings:", error)
     res.status(500).json({ message: "Internal server error" })
     return
  }
}

// Helper function to transform database column names to camelCase
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


