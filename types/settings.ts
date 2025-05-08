// User settings types
export interface NotificationPreferences {
    emailProfileViews: boolean
    emailLinkClicks: boolean
    emailPurchases: boolean
    emailMarketing: boolean
    pushAll: boolean
    pushMilestones: boolean
    pushEarnings: boolean
  }
  
  export interface AppearancePreferences {
    showLogo: boolean | undefined
    animations: boolean
    reducedMotion: boolean
  }
  
  export interface ThemeSettings {
    profileLayout: "classic" | "hero" | string
    themeColor: string
    customBackground?: string
    customTextColor?: string
    buttonStyle?: string
    buttonShadow?: boolean
    fontFamily?: string
    backgroundType?: string
    backgroundOpacity?: number
    themeSelected: string | number
  }
  
  export interface UserSettings {
    id?: string
    userId: string
  
    // Profile settings
    displayName: string
    username: string
    bio: string
    website: string
    profileImage: string | null
  
    // Account settings
    twoFactorEnabled: boolean
  
    // Appearance settings
    theme: string
  
    // JSON settings
    appearancePreferences: AppearancePreferences
    themeSettings: ThemeSettings
    notificationPreferences: NotificationPreferences
  
    // Timestamps
    createdAt?: Date
    updatedAt?: Date
  }
  
  export interface UpdateSettingsRequest {
    displayName?: string
    username?: string
    bio?: string
    website?: string
    profileImage?: string | null
    twoFactorEnabled?: boolean
    theme?: string
    appearancePreferences?: Partial<AppearancePreferences>
    themeSettings?: Partial<ThemeSettings>
    notificationPreferences?: Partial<NotificationPreferences>
  }
  
  