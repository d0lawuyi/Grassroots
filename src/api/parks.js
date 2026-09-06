import { supabase } from '../lib/supabase';

export async function getNearbyParks(lat = 39.7684, lng = -86.1581, radiusMiles = 50) {
  const { data, error } = await supabase
    .rpc('find_nearby_parks', {
      user_lat: lat,
      user_lng: lng,
      radius_miles: radiusMiles,
    });

  if (error) {
    console.error('Supabase Error:', error);
    return [];
  }
  return data;
}