// Shared types only — no runtime code. API routes are fully self-contained.
export interface DropboxFolderStats {
  photos: number;
  sketches: number;
  measurementsExists: boolean;
  notesExists: boolean;
}

export interface DropboxFolderResult {
  folderUrl: string;
  created: boolean;
}
