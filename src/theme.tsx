export const C = {
  navy: '#263E57',
  red: '#B40000',
  white: '#FFFFFF',
  cream: '#F0E6CC',
  gold: '#E8A020',
  offwhite: '#F7F7F7',
  text: '#1A1A1A',
  muted: '#6B7A8D',
  border: '#D9D9D9',
} as const;

// Norwester via jsDelivr CDN, Inter via Google Fonts
export function FontImports() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
      @font-face {
        font-family: 'Norwester';
        src: url('https://cdn.jsdelivr.net/gh/theleagueof/norwester@master/webfont/norwester.woff2') format('woff2');
        font-weight: normal;
        font-style: normal;
      }
      body, html, #root {
        margin: 0;
        padding: 0;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        background: ${C.offwhite};
      }
      .font-display {
        font-family: 'Norwester', 'Impact', sans-serif;
        letter-spacing: 0.02em;
      }
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      button { font-family: inherit; cursor: pointer; border: none; background: none; }
      input, textarea { font-family: inherit; }
    `}</style>
  );
}
