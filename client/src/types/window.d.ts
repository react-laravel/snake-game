export {};

declare global {
  interface Window {
    advanceTime?: (milliseconds: number) => void | Promise<void>;
    render_game_to_text?: () => string;
  }
}
