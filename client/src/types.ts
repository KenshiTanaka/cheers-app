export interface User {
  id: number;
  email: string;
  name: string;
  department: string;
  favorite_area: string;
  alcohol_preference: string;
  favorite_food: string;
}

export interface Review {
  id: number;
  shop_id: number;
  user_id: number;
  reviewer_name: string;
  reviewer_department?: string;
  reviewer_alcohol?: string;
  taste_rating: number;
  atmosphere_rating: number;
  drink_rating: number;
  price_rating: number;
  cost_per_person: number;
  comment: string;
  created_at: string;
}

export interface Shop {
  id: number;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  station_name: string;
  walk_minutes: number;
  japanese_staff_ratio: number;
  private_room_type: 'あり' | 'なし' | '半個室';
  image_url: string;
  created_by: number;
  creator_name?: string;
  avg_taste: number;
  avg_atmosphere: number;
  avg_drink: number;
  avg_price: number;
  overall_rating: number;
  review_count: number;
  avg_cost: number;
  reviews?: Review[];
}
