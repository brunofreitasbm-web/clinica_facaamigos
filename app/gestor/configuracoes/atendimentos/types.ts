export type ResourceRow = {
  id: string;
  name: string;
  category: string;
  notes: string | null;
};

export type RoomRow = {
  id: string;
  name: string;
  capacity: number;
};
