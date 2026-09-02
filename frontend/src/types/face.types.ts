export interface FaceData {
  faceShape: 'עגול' | 'אובלי' | 'מרובע' | 'לבבי' | 'משולש';
  faceWidth: number;
  faceHeight: number;
  ratio: number;
  capturedImage?: string | null;  
}

export interface PreviousFrame {
  image?: string | null;
  liked: boolean;
  reason: string;
}

export interface UserSession {
  faceData: FaceData | null;
  answers: {
    usage: string;
    budget: string;
    style: string;
    gender?: string;
  };
  selectedFrameId: string | null;
  previousFrame: PreviousFrame | null;
}