export type ProductCategory =
  | "food"
  | "beverage"
  | "snack"
  | "dairy"
  | "baby_food"
  | "skincare"
  | "haircare"
  | "cosmetic"
  | "household"
  | "water";

export type ScoreGrade = "A" | "B" | "C" | "D" | "E";

export type ScanSource = "barcode" | "ocr" | "search" | "web";

export type SubscriptionTier = "free" | "pro" | "family";

export type SubmissionStatus = "pending" | "approved" | "rejected";

export type WaterSource = "tap" | "borewell" | "packaged";

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string;
          barcode: string;
          name: string;
          brand: string;
          category: ProductCategory;
          image_url: string | null;
          ingredients: string[];
          nutritional_info: Record<string, unknown>;
          safety_score: number | null;
          score_grade: ScoreGrade | null;
          fssai_license: string | null;
          analysis: Record<string, unknown> | null;
          source: string;
          created_at: string;
          updated_at: string;
          verified: boolean;
          scan_count: number;
        };
        Insert: {
          id?: string;
          barcode: string;
          name: string;
          brand: string;
          category: ProductCategory;
          image_url?: string | null;
          ingredients: string[];
          nutritional_info?: Record<string, unknown>;
          safety_score?: number | null;
          score_grade?: ScoreGrade | null;
          fssai_license?: string | null;
          analysis?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
          verified?: boolean;
          scan_count?: number;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
      };
      scans: {
        Row: {
          id: string;
          user_id: string | null;
          product_id: string;
          scanned_at: string;
          source: ScanSource;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          product_id: string;
          scanned_at?: string;
          source: ScanSource;
        };
        Update: Partial<Database["public"]["Tables"]["scans"]["Insert"]>;
      };
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          display_name: string;
          health_conditions: string[];
          allergies: string[];
          language_preference: string;
          subscription_tier: SubscriptionTier;
          created_at: string;
          onboarded: boolean;
          scan_history: unknown;
          scan_count: number;
          recent_searches: string[];
          compare_list: unknown;
          bookmarks: unknown;
        };
        Insert: {
          id?: string;
          user_id: string;
          display_name: string;
          health_conditions?: string[];
          allergies?: string[];
          language_preference?: string;
          subscription_tier?: SubscriptionTier;
          created_at?: string;
          onboarded?: boolean;
          scan_history?: unknown;
          scan_count?: number;
          recent_searches?: string[];
          compare_list?: unknown;
          bookmarks?: unknown;
        };
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Insert"]>;
      };
      community_submissions: {
        Row: {
          id: string;
          user_id: string;
          product_name: string;
          barcode: string;
          label_image_url: string;
          extracted_ingredients: string[];
          status: SubmissionStatus;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_name: string;
          barcode: string;
          label_image_url: string;
          extracted_ingredients?: string[];
          status?: SubmissionStatus;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["community_submissions"]["Insert"]>;
      };
      water_quality: {
        Row: {
          id: string;
          district: string;
          state: string;
          source: WaterSource;
          ph: number;
          tds: number;
          hardness: number;
          contaminants: Record<string, unknown>;
          tested_at: string;
          data_source: string;
        };
        Insert: {
          id?: string;
          district: string;
          state: string;
          source: WaterSource;
          ph: number;
          tds: number;
          hardness: number;
          contaminants?: Record<string, unknown>;
          tested_at: string;
          data_source: string;
        };
        Update: Partial<Database["public"]["Tables"]["water_quality"]["Insert"]>;
      };
    };
    Enums: {
      product_category: ProductCategory;
      score_grade: ScoreGrade;
      scan_source: ScanSource;
      subscription_tier: SubscriptionTier;
      submission_status: SubmissionStatus;
      water_source: WaterSource;
    };
  };
}

// Convenience aliases
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
export type Scan = Database["public"]["Tables"]["scans"]["Row"];
export type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];
export type CommunitySubmission = Database["public"]["Tables"]["community_submissions"]["Row"];
export type CommunitySubmissionInsert = Database["public"]["Tables"]["community_submissions"]["Insert"];
export type WaterQuality = Database["public"]["Tables"]["water_quality"]["Row"];
