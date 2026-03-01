export default function ArcadeBurst() {
  return (
    <div className="arcade-burst" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
      {[
        { top: '0%', left: '10%', dx: '0px', dy: '-35px' },
        { top: '0%', left: '30%', dx: '0px', dy: '-35px' },
        { top: '0%', left: '70%', dx: '0px', dy: '-35px' },
        { top: '0%', left: '90%', dx: '0px', dy: '-35px' },
        { top: '100%', left: '20%', dx: '0px', dy: '35px' },
        { top: '100%', left: '80%', dx: '0px', dy: '35px' },
        { top: '50%', left: '0%', dx: '-35px', dy: '0px' },
        { top: '50%', left: '100%', dx: '35px', dy: '0px' },
      ].map((pos, index) => (
        <span
          key={index}
          className="sparkle-shard"
          style={
            {
              top: pos.top,
              left: pos.left,
              '--dx': pos.dx,
              '--dy': pos.dy,
            } as React.CSSProperties
          }
        >
          ✨
        </span>
      ))}
      {[
        { left: '25%', color: '#2563EB', symbol: '♪', delay: '0ms' },
        { left: '40%', color: '#10B981', symbol: '♫', delay: '60ms' },
        { left: '60%', color: '#7C3AED', symbol: '♪', delay: '120ms' },
        { left: '75%', color: '#EF4444', symbol: '♫', delay: '180ms' },
      ].map((note, index) => (
        <span
          key={index}
          className="music-note"
          style={{
            left: note.left,
            color: note.color,
            animationDelay: note.delay,
          }}
        >
          {note.symbol}
        </span>
      ))}
    </div>
  );
}
