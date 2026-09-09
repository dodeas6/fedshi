export interface Profile {
  id: string
  username: string
  full_name: string
  bio: string
  avatar_url: string
  role: 'viewer' | 'merchant' | 'admin' | 'super_admin'
  is_verified: boolean
  is_private: boolean
  is_banned: boolean
  coins: number
  created_at: string
}

export interface Video {
  id: string
  user_id: string
  title: string
  description: string
  price: number
  video_url: string
  thumbnail_url: string
  status: 'approved' | 'pending' | 'rejected'
  is_private: boolean
  views_count: number
  likes_count: number
  comments_count: number
  sound_name: string
  moderation_note: string
  category: string
  video_type: 'reel' | 'product'
  is_trending: boolean
  avg_rating: number
  reviews_count: number
  created_at: string
}

export interface ProductReview {
  id: string
  order_id: string
  video_id: string
  buyer_id: string
  rating: number
  comment: string
  created_at: string
  buyer?: Profile | null
}

export interface VideoWithProfile extends Video {
  profiles: Profile | null
  is_liked?: boolean
  is_saved?: boolean
  is_following?: boolean
}

export interface Comment {
  id: string
  user_id: string
  video_id: string
  text: string
  parent_id: string | null
  created_at: string
  profiles: Profile | null
}

export interface ProductVariant {
  id: string
  video_id: string
  variant_type: 'size' | 'color'
  option_name: string
  option_hex: string | null
  stock: number
  sort_order: number
}

export interface Order {
  id: string
  order_code: string
  video_id: string
  merchant_id: string
  buyer_id: string | null
  buyer_name: string
  phone: string
  province: string
  address: string
  total_price: number
  selected_size: string | null
  shared_location: string | null
  selected_color: string | null
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  created_at: string
  videos?: Video | null
}

export interface Report {
  id: string
  reporter_id: string
  video_id: string
  reason: string
  status: 'pending' | 'reviewed' | 'actioned'
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  actor_id: string | null
  type: 'like' | 'comment' | 'follow' | 'order' | 'system' | 'message'
  video_id: string | null
  text: string
  is_read: boolean
  created_at: string
  actor?: Profile | null
}

export interface Conversation {
  id: string
  user_a: string
  user_b: string
  last_message: string
  last_message_at: string
  created_at: string
  otherUser?: Profile | null
  unreadCount?: number
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
}
