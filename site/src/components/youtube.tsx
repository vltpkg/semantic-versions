"use client";

import { useState } from "react";

/*
 * YouTube embeds load only when played: the page shows the thumbnail as a
 * link to YouTube, and a click swaps in the privacy-enhanced
 * (youtube-nocookie) player, so no YouTube script or cookie loads for
 * visitors who don't press play. A modified click opens YouTube instead.
 */
export function YouTube({ id, title, label }: { id: string; title: string; label: string }) {
  const [playing, setPlaying] = useState(false);
  const [thumb, setThumb] = useState(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);
  return (
    <div className="video" data-youtube={id} data-title={title}>
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          // YouTube refuses to play embeds that arrive without a referrer.
          referrerPolicy="strict-origin-when-cross-origin"
          ref={(el) => el?.focus()}
        />
      ) : (
        <a
          className="video-facade"
          href={`https://www.youtube.com/watch?v=${id}`}
          target="_blank"
          rel="noopener"
          aria-label={label}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            setPlaying(true);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a remote thumbnail with its own fallback */}
          <img
            src={thumb}
            alt=""
            width={1280}
            height={720}
            loading="lazy"
            decoding="async"
            onError={() => setThumb(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)}
          />
          <span className="video-play" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </span>
        </a>
      )}
    </div>
  );
}
