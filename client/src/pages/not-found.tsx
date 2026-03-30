import { useEffect, useRef } from "react";
import notFoundSound from "../../../faah.mp3";
import { StarsBackground } from "@/components/backgrounds/StarsBackground";

const NOT_FOUND_PLAYBACK_RATE = 1.28;
let cachedNotFoundAudio: HTMLAudioElement | null = null;

const getNotFoundAudio = () => {
  if (!cachedNotFoundAudio) {
    cachedNotFoundAudio = new Audio(notFoundSound);
    cachedNotFoundAudio.preload = "auto";
    cachedNotFoundAudio.volume = 1;
    cachedNotFoundAudio.playbackRate = NOT_FOUND_PLAYBACK_RATE;
    cachedNotFoundAudio.defaultPlaybackRate = NOT_FOUND_PLAYBACK_RATE;
    cachedNotFoundAudio.load();
  }
  return cachedNotFoundAudio;
};

export default function NotFound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = getNotFoundAudio();
    audioRef.current = audio;
    audio.playbackRate = NOT_FOUND_PLAYBACK_RATE;
    audio.defaultPlaybackRate = NOT_FOUND_PLAYBACK_RATE;
    audio.currentTime = 0;

    const playInstant = () => {
      const playPromise = audio.play();
      return playPromise && typeof playPromise.then === "function"
        ? playPromise.then(() => true).catch(() => false)
        : Promise.resolve(true);
    };

    let cleanupRetry: (() => void) | null = null;
    playInstant().then((started) => {
      if (started) return;

      const retryPlay = () => {
        audio.currentTime = 0;
        void playInstant();
      };

      audio.addEventListener("canplaythrough", retryPlay, { once: true });
      window.addEventListener("pointerdown", retryPlay, { once: true });
      window.addEventListener("keydown", retryPlay, { once: true });

      cleanupRetry = () => {
        audio.removeEventListener("canplaythrough", retryPlay);
        window.removeEventListener("pointerdown", retryPlay);
        window.removeEventListener("keydown", retryPlay);
      };
    });

    const visibilityPlay = () => {
      if (document.visibilityState === "visible") {
        audio.currentTime = 0;
        void playInstant();
      }
    };
    document.addEventListener("visibilitychange", visibilityPlay);

    return () => {
      document.removeEventListener("visibilitychange", visibilityPlay);
      if (cleanupRetry) cleanupRetry();
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, []);


  return (
    <div className="fixed inset-0 bg-[#07060a] overflow-hidden z-[9999]" id="loader-container">
      {/* Premium Styles */}
      <style>{`
        *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

        .grain { position:fixed; inset:-100%; width:300%; height:300%;
          background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E");
          background-size:180px; animation:grain .55s steps(2) infinite; pointer-events:none; z-index:3; opacity:.34; }
        @keyframes grain { 0%{transform:translate(0,0)} 25%{transform:translate(-2%,1%)} 50%{transform:translate(2%,-2%)} 75%{transform:translate(-1%,2%)} 100%{transform:translate(2%,-1%)} }

        .vignette { position:fixed; inset:0; z-index:4; pointer-events:none;
          background:radial-gradient(ellipse 80% 70% at 50% 50%, transparent 25%, rgba(7,6,10,0.9) 100%); }

        .stage { position:relative; z-index:20; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; width:100%; padding:0 20px; animation:stageIn .38s ease-out both; }
        @keyframes stageIn { from { opacity:0; transform:translateY(8px) scale(.992); } to { opacity:1; transform:translateY(0) scale(1); } }

        .mono-wrap { position:relative; width:clamp(96px,16vw,132px); height:clamp(96px,16vw,132px); margin-bottom:28px; }
        .mono-ring { width:100%; height:100%; animation:spinSlow 14s linear infinite; }
        @keyframes spinSlow { to{transform:rotate(360deg)} }
        .mono-inner { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; }
        .mono-letter { font-family:'Cinzel',serif; font-size:clamp(1.8rem,5vw,2.8rem); font-weight:600; color:#c8a96d; text-shadow:0 0 28px rgba(200,169,109,.55); letter-spacing:.04em; }

        .brand-rare { font-family:'Cormorant Garamond',serif; font-style:italic; font-weight:300; font-size:clamp(4rem,13vw,8.5rem); color:#f2efe8; line-height:.9; letter-spacing:.04em; text-align:center; }
        .brand-atelier { font-family:'DM Mono',monospace; font-size:clamp(.48rem,1.6vw,.72rem); font-weight:400; letter-spacing:.72em; text-transform:uppercase; color:#c8a96d; padding-left:.72em; margin-top:7px; }

        .tagline { font-family:'Cormorant Garamond',serif; font-style:italic; font-weight:300; font-size:clamp(.68rem,1.8vw,.92rem); color:rgba(242,239,232,0.8); letter-spacing:.22em; text-align:center; margin-top:20px; }
        .not-found-msg { font-family:'DM Mono',monospace; font-size:clamp(.55rem,1.2vw,.8rem); letter-spacing:.32em; text-transform:uppercase; color:rgba(200,169,109,.5); margin-top:15px; }

        .back-link { position:relative; margin-top:40px; padding:12px 30px; border:1px solid rgba(200,169,109,0.3); font-family:'DM Mono',monospace; color:#c8a96d; text-transform:uppercase; letter-spacing:0.3em; font-size:0.7rem; cursor:pointer; transition:all 0.3s; z-index:30; pointer-events: auto; }
        .back-link:hover { background: rgba(200,169,109,0.1); border-color: #c8a96d; }
      `}</style>

      <StarsBackground className="z-[2] opacity-85" />
      <div className="grain"></div>
      <div className="vignette"></div>

      <div className="stage">
        {/* Monogram ring */}
        <div className="mono-wrap">
          <svg className="mono-ring" viewBox="0 0 132 132">
            <circle cx="66" cy="66" r="62" stroke="rgba(200,169,109,0.12)" strokeWidth=".5" fill="none"/>
            <circle cx="66" cy="66" r="55" stroke="rgba(200,169,109,0.22)" strokeWidth=".5" fill="none" strokeDasharray="3 6"/>
            <g stroke="rgba(200,169,109,0.45)" strokeWidth="1">
              <line x1="66" y1="5" x2="66" y2="14"/>
              <line x1="66" y1="5" x2="66" y2="14" transform="rotate(30 66 66)"/>
              <line x1="66" y1="5" x2="66" y2="14" transform="rotate(60 66 66)"/>
              <line x1="66" y1="5" x2="66" y2="14" transform="rotate(90 66 66)"/>
              <line x1="66" y1="5" x2="66" y2="14" transform="rotate(120 66 66)"/>
              <line x1="66" y1="5" x2="66" y2="14" transform="rotate(150 66 66)"/>
              <line x1="66" y1="5" x2="66" y2="14" transform="rotate(180 66 66)"/>
              <line x1="66" y1="5" x2="66" y2="14" transform="rotate(210 66 66)"/>
              <line x1="66" y1="5" x2="66" y2="14" transform="rotate(240 66 66)"/>
              <line x1="66" y1="5" x2="66" y2="14" transform="rotate(270 66 66)"/>
              <line x1="66" y1="5" x2="66" y2="14" transform="rotate(300 66 66)"/>
              <line x1="66" y1="5" x2="66" y2="14" transform="rotate(330 66 66)"/>
            </g>
            <rect x="64" y="2" width="4" height="4" fill="rgba(200,169,109,0.7)" transform="rotate(45 66 4)"/>
            <rect x="64" y="126" width="4" height="4" fill="rgba(200,169,109,0.7)" transform="rotate(45 66 128)"/>
            <rect x="2" y="64" width="4" height="4" fill="rgba(200,169,109,0.7)" transform="rotate(45 4 66)"/>
            <rect x="126" y="64" width="4" height="4" fill="rgba(200,169,109,0.7)" transform="rotate(45 128 66)"/>
            <circle cx="66" cy="66" r="42" stroke="rgba(200,169,109,0.06)" strokeWidth="8" fill="none"/>
          </svg>
          <div className="mono-inner">
            <div className="mono-letter">404</div>
          </div>
        </div>

        <div className="brand-rare">Lost in Atelier</div>
        <div className="brand-atelier">Page Not Found</div>

        <div className="tagline">&nbsp;</div>
        <div className="not-found-msg">&nbsp;</div>

        <button 
          className="back-link pointer-events-auto" 
          onClick={() => window.location.href = "/"}
        >
          Return to Collections
        </button>
      </div>

      <div className="fixed bottom-8 left-0 right-0 flex justify-between px-10 z-20 pointer-events-none opacity-40">
        <div className="font-mono text-[0.45rem] tracking-[0.3em] uppercase text-[#c8a96d]">Est. MMXXIV</div>
        <div className="font-mono text-[0.45rem] tracking-[0.3em] uppercase text-[#c8a96d]">Paris · Tokyo · NYC</div>
      </div>
    </div>
  );
}
