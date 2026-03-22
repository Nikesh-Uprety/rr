/**
 * Short alert when a new admin notification arrives over WebSocket.
 * Safari/iOS may block playback until the user has interacted with the page; play() failures are ignored.
 */

const DEBOUNCE_MS = 400;

let audio: HTMLAudioElement | null = null;
let lastPlayAt = 0;

function getSrc(): string {
  return `${import.meta.env.BASE_URL}sounds/notification.mp3`;
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(getSrc());
    audio.preload = "auto";
  }
  return audio;
}

export function playNotificationSound(): void {
  const now = Date.now();
  if (now - lastPlayAt < DEBOUNCE_MS) return;
  lastPlayAt = now;

  const el = getAudio();
  el.currentTime = 0;
  void el.play().catch(() => {
    // Autoplay policy or missing file — badge still updates
  });
}
