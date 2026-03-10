// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  interface Window {
    SetWallpaper(): void;
    saveBackgroundFile(file: File): Promise<void>;
    RetrieveCalendarFromUser(username: String): Promise<string>;
  }

  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
