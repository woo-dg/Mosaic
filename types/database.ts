export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
        }
      }
      submissions: {
        Row: {
          id: string
          restaurant_id: string
          created_at: string
          instagram_handle: string | null
          feedback: string | null
          allow_marketing: boolean
          agreed_private: boolean
        }
        Insert: {
          id?: string
          restaurant_id: string
          created_at?: string
          instagram_handle?: string | null
          feedback?: string | null
          allow_marketing?: boolean
          agreed_private: boolean
        }
        Update: {
          id?: string
          restaurant_id?: string
          created_at?: string
          instagram_handle?: string | null
          feedback?: string | null
          allow_marketing?: boolean
          agreed_private?: boolean
        }
      }
      photos: {
        Row: {
          id: string
          submission_id: string
          file_path: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          submission_id: string
          file_path: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          submission_id?: string
          file_path?: string
          uploaded_at?: string
        }
      }
      manager_users: {
        Row: {
          id: string
          manager_id: string
          restaurant_id: string
          created_at: string
        }
        Insert: {
          id?: string
          manager_id: string
          restaurant_id: string
          created_at?: string
        }
        Update: {
          id?: string
          manager_id?: string
          restaurant_id?: string
          created_at?: string
        }
      }
    }
  }
}





