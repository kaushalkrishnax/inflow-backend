// JWT Token payload
export interface TokenPayload {
    userId: string
    iat?: number
    exp?: number
    [key: string]: any
  }
  
  // User data from database
  export interface User {
    id: string
    username: string
    email: string
    password: string
    is_verified: boolean
    verification_token: string | null
    reset_token: string | null
    reset_token_expiry: Date | null
    google_id: string | null
    created_at: Date
    updated_at: Date
  }
  
  // Refresh token data
  export interface RefreshToken {
    id: string
    token: string
    user_id: string
    expires_at: Date
    created_at: Date
  }
  
  // Request body types
  export interface SignupRequest {
    username: string
    email: string
    password: string
  }
  
  export interface LoginRequest {
    email: string
    password: string
  }
  
  export interface ResetPasswordRequest {
    password: string
  }
  
  export interface GoogleAuthRequest {
    token: string
  }
  
  export interface InstagramProfile {
    username: string
    full_name: string
    biography: string
    profile_pic_url: string
    is_private: boolean
    is_verified: boolean
    followers: number
    following: number
    posts_count: number
    external_url: string
    engagement_rate: number
    recent_posts: any[]
    total_likes: number
    total_comments: number,
    stats: object,
    price_per_post: number,
  }
  
  export interface InstagramPost {
    post_id: string
    caption: string
    media_url: string
    post_type: string
    timestamp: number
    likes: number
    comments: number
    engagement_rate: number
    hashtags: string[]
    mentions: string[]
    video_view_count?: number,
    day_posted:string
  }
  
  export interface MonitoredUser {
    id: number
    username: string
    user_id: string
  }
  
  export interface UserData {
    id: number
    username: string
    user_id: string
    full_name: string
    biography: string
    profile_pic_url: string
    is_private: boolean
    is_verified: boolean
    followers: number
    following: number
    posts_count: number
    external_url: string
    engagement_rate: number
    recent_posts: InstagramPost[]
    total_likes: number
    total_comments: number
    timestamp: Date
  }
  
  export interface TiktokVideo {
    video_id: string
    video_url: string
    video_cover: string
    caption: string
    likes: number
    comments: number
    shares: number
    views: number
    timestamp: number
  }
  
  export interface TiktokUserData {
    username: string
    full_name: string
    profile_pic_url: string
    bio: string
    followers: number
    following: number
    likes: number
    comments:number
    videos: number
    is_verified: boolean
    recent_videos: any[]
    total_likes: number
    total_comments: number
    total_shares: number
    total_views: number
    engagement_rate: number
    timestamp: string,
    stats:object
  }
  
  
  export interface YoutubeVideo {
    video_id: string
    title: string
    description: string
    published_at: string
    thumbnail_url: string
    likes: number
    comments: number
    views: number
    engagement_rate: number
  }
  
  export interface YoutubeUserData {
    username: string
    channel_name: string
    profile_pic_url: string
    description: string
    subscribers: number
    total_views: number
    total_videos: number
    recent_videos: YoutubeVideo[]
    total_likes: string | number
    total_comments: string | number
    engagement_rate: number
    timestamp: string,
    stats: object
  }
  
  