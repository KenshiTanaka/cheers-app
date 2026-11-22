import React, { useMemo } from 'react';

interface BubbleSpec {
  left: string;
  size: string;
  duration: string;
  delay: string;
}

export const BubblesBackground: React.FC = React.memo(() => {
  const bubbles = useMemo<BubbleSpec[]>(() => {
    return Array.from({ length: 15 }, () => {
      const size = Math.random() * 20 + 10;
      return {
        left: `${Math.random() * 100}%`,
        size: `${size}px`,
        duration: `${Math.random() * 4 + 3}s`,
        delay: `${Math.random() * 2}s`,
      };
    });
  }, []);

  return (
    <div className="bubbles-container" aria-hidden="true">
      {bubbles.map((b, i) => (
        <div
          key={i}
          className="bubble"
          style={{
            left: b.left,
            width: b.size,
            height: b.size,
            animationDuration: b.duration,
            animationDelay: b.delay,
          }}
        />
      ))}
    </div>
  );
});
