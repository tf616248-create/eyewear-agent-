export interface Frame {
  id: string;
  name: string;
  shape: string;
  color: string;
  material: string;
  size: 'S' | 'M' | 'L' | 'XL';
  gender: 'גבר' | 'אישה' | 'יוניסקס';
  style: string;
  price: number;
  stock: number;
  face_shapes_match: string[];
  bridge_width: 'צר' | 'בינוני' | 'רחב';
  temple_length: 'קצר' | 'בינוני' | 'ארוך';
  weight: 'קל' | 'בינוני' | 'כבד';
  description: string;
  image: string;
}








