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
  ban_reason: string
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
  sizes: string[]
  colors: string[]
  created_at: string
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
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  selected_size: string
  selected_color: string
  created_at: string
  videos?: Video | null
}

export interface Notification {
  id: string
  user_id: string
  actor_id: string | null
  type: 'like' | 'comment' | 'follow' | 'order' | 'system'
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
  last_message_at: string
  created_at: string
  other_user?: Profile | null
  last_message?: Message | null
  unread_count?: number
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  text: string
  is_read: boolean
  created_at: string
}
