export interface Book {
  id: string;
  title: string;
  description?: string;
  category?: string;
  coverColor: string;
  userId: string;
  createdAt: any;
}

export interface ContentBlock {
  id: string;
  type: 'text' | 'image' | 'bundle';
  value: string | string[]; // string for text/image, string[] for bundle
}

export interface Page {
  id: string;
  bookId: string;
  chapterTitle?: string;
  chapterDetails?: string;
  content: ContentBlock[];
  pageNumber: number;
  timestamp: any;
  userId: string;
}

export interface AudioSettings {
  isMuted: boolean;
  volume: number;
}
