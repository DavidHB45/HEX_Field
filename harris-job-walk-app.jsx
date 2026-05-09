import React, { useState, useRef, useEffect } from 'react';
import { Camera, Pencil, Ruler, Mic, ArrowLeft, MapPin, Clock, Search, Plus, Check, X, Square, Trash2, Download, FolderOpen, ChevronRight } from 'lucide-react';

// ============================================================
// MOCK DATA — simulates the existing Project Opportunities table
// ============================================================
const MOCK_OPPORTUNITIES = [
  {
    id: 'rec001',
    name: 'Morgan Hill Site Development',
    client: 'Sarah & Tom Mitchell',
    address: '14820 Hill Country Rd, Morgan Hill, CA',
    status: 'Site Visit Scheduled',
    estimatedValue: '$185,000',
    lastVisit: null,
    photoCount: 0,
    dropboxFolder: null,
  },
  {
    id: 'rec002',
    name: 'Atherton Pool Excavation',
    client: 'James Chen',
    address: '92 Selby Ln, Atherton, CA',
    status: 'Bidding',
    estimatedValue: '$92,000',
    lastVisit: '2026-04-28',
    photoCount: 14,
    dropboxFolder: 'https://dropbox.com/...',
  },
  {
    id: 'rec003',
    name: 'Mammoth Driveway Grade',
    client: 'Linda Park',
    address: '305 Forest Trail, Mammoth Lakes, CA',
    status: 'New Lead',
    estimatedValue: '$48,000',
    lastVisit: null,
    photoCount: 0,
    dropboxFolder: null,
  },
  {
    id: 'rec004',
    name: 'Woodside Retaining Wall',
    client: 'Marcus Holloway',
    address: '1180 Mountain Home Rd, Woodside, CA',
    status: 'Bidding',
    estimatedValue: '$67,500',
    lastVisit: '2026-05-02',
    photoCount: 22,
    dropboxFolder: 'https://dropbox.com/...',
  },
];

// ============================================================
// BRAND TOKENS
// ============================================================
const C = {
  navy: '#263E57',
  red: '#B40000',
  white: '#FFFFFF',
  cream: '#F0E6CC',
  gold: '#E8A020',
  offwhite: '#F7F7F7',
  text: '#1A1A1A',
  muted: '#6B7A8D',
  border: '#D9D9D9',
};

// Norwester via CDN, Inter via Google Fonts
const FontImports = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    @font-face {
      font-family: 'Norwester';
      src: url('https://cdn.jsdelivr.net/gh/theleagueof/norwester@master/webfont/norwester.woff2') format('woff2');
      font-weight: normal;
      font-style: normal;
    }
    body, html, #root { margin: 0; padding: 0; font-family: 'Inter', system-ui, -apple-system, sans-serif; background: ${C.offwhite}; }
    .font-display { font-family: 'Norwester', 'Impact', sans-serif; letter-spacing: 0.02em; }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    button { font-family: inherit; cursor: pointer; border: none; background: none; }
    input, textarea { font-family: inherit; }
  `}</style>
);

// ============================================================
// HEADER — appears on every screen
// ============================================================
const AppHeader = ({ title, onBack, subtitle }) => (
  <div style={{ background: C.navy, color: C.white, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 10, borderBottom: `3px solid ${C.red}` }}>
    {onBack && (
      <button onClick={onBack} style={{ color: C.white, padding: 4, display: 'flex' }}>
        <ArrowLeft size={22} />
      </button>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="font-display" style={{ fontSize: 18, lineHeight: 1.1 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</div>}
    </div>
  </div>
);

// ============================================================
// OPPORTUNITIES LIST — the home screen
// ============================================================
const OpportunitiesList = ({ opportunities, onSelect }) => {
  const [search, setSearch] = useState('');
  const filtered = opportunities.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.client.toLowerCase().includes(search.toLowerCase()) ||
    o.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', background: C.offwhite }}>
      <div style={{ background: C.navy, color: C.white, padding: '20px 16px 16px' }}>
        <div className="font-display" style={{ fontSize: 22, marginBottom: 2 }}>HARRIS EXCAVATION</div>
        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 16 }}>Job Walk · Field Capture</div>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input
            placeholder="Search opportunities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 4, border: 'none', background: C.white, color: C.text, fontSize: 14 }}
          />
        </div>
      </div>

      <div style={{ padding: '8px 12px' }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 0.5, padding: '12px 4px 8px', textTransform: 'uppercase' }}>
          {filtered.length} Active {filtered.length === 1 ? 'Opportunity' : 'Opportunities'}
        </div>

        {filtered.map(opp => (
          <button
            key={opp.id}
            onClick={() => onSelect(opp)}
            style={{ width: '100%', textAlign: 'left', background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, padding: 14, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div className="font-display" style={{ fontSize: 16, color: C.navy, lineHeight: 1.2 }}>{opp.name}</div>
              <ChevronRight size={18} color={C.muted} style={{ flexShrink: 0, marginTop: 2 }} />
            </div>
            <div style={{ fontSize: 13, color: C.text }}>{opp.client}</div>
            <div style={{ fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={11} /> {opp.address}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: opp.lastVisit ? C.navy : C.red, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                {opp.lastVisit ? `Visited ${opp.lastVisit}` : 'Not Yet Visited'}
              </span>
              <span style={{ fontSize: 11, color: C.muted }}>
                {opp.photoCount > 0 ? `${opp.photoCount} files` : 'No files'}
              </span>
            </div>
          </button>
        ))}
      </div>

      <div style={{ background: C.navy, color: C.white, padding: '12px 16px', fontSize: 10, textAlign: 'center', opacity: 0.7, marginTop: 20 }}>
        CSLB #1117960 · Build Smarter. Dig Deeper.
      </div>
    </div>
  );
};

// ============================================================
// OPPORTUNITY DETAIL — tabbed workspace
// ============================================================
const OpportunityDetail = ({ opportunity, onBack, captureData, setCaptureData }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const oppData = captureData[opportunity.id] || { photos: [], sketches: [], measurements: [], notes: [] };

  const updateOppData = (updates) => {
    setCaptureData({
      ...captureData,
      [opportunity.id]: { ...oppData, ...updates },
    });
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FolderOpen },
    { id: 'photos', label: 'Photos', icon: Camera, count: oppData.photos.length },
    { id: 'sketches', label: 'Sketches', icon: Pencil, count: oppData.sketches.length },
    { id: 'measure', label: 'Measure', icon: Ruler, count: oppData.measurements.length },
    { id: 'notes', label: 'Notes', icon: Mic, count: oppData.notes.length },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.offwhite, paddingBottom: 80 }}>
      <AppHeader
        title={opportunity.name}
        subtitle={opportunity.client}
        onBack={onBack}
      />

      {/* Tab bar */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, display: 'flex', overflowX: 'auto', position: 'sticky', top: 60, zIndex: 9 }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: '0 0 auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                color: active ? C.red : C.muted, borderBottom: `3px solid ${active ? C.red : 'transparent'}`,
                position: 'relative', minWidth: 70,
              }}
            >
              <Icon size={20} />
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tab.label}</span>
              {tab.count > 0 && (
                <span style={{ position: 'absolute', top: 6, right: 12, background: C.red, color: C.white, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, minWidth: 16 }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && <OverviewTab opportunity={opportunity} oppData={oppData} />}
      {activeTab === 'photos' && <PhotosTab oppData={oppData} updateOppData={updateOppData} />}
      {activeTab === 'sketches' && <SketchesTab oppData={oppData} updateOppData={updateOppData} />}
      {activeTab === 'measure' && <MeasurementsTab oppData={oppData} updateOppData={updateOppData} />}
      {activeTab === 'notes' && <NotesTab oppData={oppData} updateOppData={updateOppData} />}
    </div>
  );
};

// ============================================================
// OVERVIEW TAB
// ============================================================
const OverviewTab = ({ opportunity, oppData }) => {
  const folderName = `${opportunity.name}`;
  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: C.cream, border: `1px solid ${C.border}`, padding: 16, marginBottom: 16, borderRadius: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.navy, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Dropbox Folder</div>
        <div style={{ fontSize: 13, color: C.text, fontFamily: 'monospace', marginBottom: 4 }}>Current Opportunities/</div>
        <div style={{ fontSize: 13, color: C.text, fontFamily: 'monospace', marginLeft: 12 }}>└── {folderName}/</div>
        <div style={{ fontSize: 12, color: C.muted, fontFamily: 'monospace', marginLeft: 28, marginTop: 4 }}>├── Photos/ ({oppData.photos.length})</div>
        <div style={{ fontSize: 12, color: C.muted, fontFamily: 'monospace', marginLeft: 28 }}>├── Sketches/ ({oppData.sketches.length})</div>
        <div style={{ fontSize: 12, color: C.muted, fontFamily: 'monospace', marginLeft: 28 }}>├── measurements.md ({oppData.measurements.length} entries)</div>
        <div style={{ fontSize: 12, color: C.muted, fontFamily: 'monospace', marginLeft: 28 }}>└── site-notes.md ({oppData.notes.length} entries)</div>
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.border}`, padding: 16, marginBottom: 16, borderRadius: 4 }}>
        <div className="font-display" style={{ fontSize: 14, color: C.navy, marginBottom: 12 }}>OPPORTUNITY DETAILS</div>
        <DetailRow label="Client" value={opportunity.client} />
        <DetailRow label="Address" value={opportunity.address} />
        <DetailRow label="Status" value={opportunity.status} />
        <DetailRow label="Est. Value" value={opportunity.estimatedValue} />
      </div>

      <div style={{ background: C.navy, color: C.white, padding: 14, borderRadius: 4, textAlign: 'center' }}>
        <div className="font-display" style={{ fontSize: 13, marginBottom: 4 }}>BUILD SMARTER. DIG DEEPER.</div>
        <div style={{ fontSize: 10, opacity: 0.7 }}>Tap any tab above to start capturing</div>
      </div>
    </div>
  );
};

const DetailRow = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
    <span style={{ color: C.muted }}>{label}</span>
    <span style={{ color: C.text, fontWeight: 600, textAlign: 'right' }}>{value}</span>
  </div>
);

// ============================================================
// PHOTOS TAB
// ============================================================
const PhotosTab = ({ oppData, updateOppData }) => {
  const fileInputRef = useRef(null);

  const handleCapture = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newPhoto = {
          id: Date.now() + Math.random(),
          dataUrl: ev.target.result,
          timestamp: new Date().toISOString(),
          gps: { lat: 37.6547, lng: -122.4077 }, // mocked SF location
          filename: `IMG_${Date.now()}.jpg`,
        };
        updateOppData({ photos: [...oppData.photos, newPhoto] });
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div style={{ padding: 16 }}>
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple onChange={handleCapture} style={{ display: 'none' }} />
      <button
        onClick={() => fileInputRef.current?.click()}
        style={{ width: '100%', background: C.red, color: C.white, padding: 16, borderRadius: 4, fontWeight: 700, fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, letterSpacing: 0.5 }}
      >
        <Camera size={20} /> CAPTURE PHOTO
      </button>

      {oppData.photos.length === 0 ? (
        <EmptyState icon={Camera} text="No photos captured yet" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {oppData.photos.map(photo => (
            <div key={photo.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 4, overflow: 'hidden', border: `1px solid ${C.border}` }}>
              <img src={photo.dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', color: C.white, padding: '12px 6px 4px', fontSize: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <MapPin size={9} /> GPS tagged
                </div>
              </div>
              <button
                onClick={() => updateOppData({ photos: oppData.photos.filter(p => p.id !== photo.id) })}
                style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(180,0,0,0.9)', color: C.white, padding: 4, borderRadius: 4 }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// SKETCHES TAB — Apple Pencil canvas
// ============================================================
const SketchesTab = ({ oppData, updateOppData }) => {
  const [drawing, setDrawing] = useState(false);
  const [editingSketch, setEditingSketch] = useState(null);

  if (drawing) {
    return <SketchCanvas
      onSave={(dataUrl) => {
        const newSketch = {
          id: Date.now(),
          dataUrl,
          timestamp: new Date().toISOString(),
          filename: `sketch_${Date.now()}.png`,
        };
        updateOppData({ sketches: [...oppData.sketches, newSketch] });
        setDrawing(false);
      }}
      onCancel={() => setDrawing(false)}
    />;
  }

  return (
    <div style={{ padding: 16 }}>
      <button
        onClick={() => setDrawing(true)}
        style={{ width: '100%', background: C.red, color: C.white, padding: 16, borderRadius: 4, fontWeight: 700, fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, letterSpacing: 0.5 }}
      >
        <Pencil size={20} /> NEW SKETCH
      </button>

      {oppData.sketches.length === 0 ? (
        <EmptyState icon={Pencil} text="No sketches yet — tap above to draw with Apple Pencil" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {oppData.sketches.map(sk => (
            <div key={sk.id} style={{ position: 'relative', aspectRatio: '1', background: C.white, borderRadius: 4, overflow: 'hidden', border: `1px solid ${C.border}` }}>
              <img src={sk.dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              <button
                onClick={() => updateOppData({ sketches: oppData.sketches.filter(s => s.id !== sk.id) })}
                style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(180,0,0,0.9)', color: C.white, padding: 4, borderRadius: 4 }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// SKETCH CANVAS — pressure-sensitive drawing
// ============================================================
const SketchCanvas = ({ onSave, onCancel }) => {
  const canvasRef = useRef(null);
  const [color, setColor] = useState(C.navy);
  const [strokes, setStrokes] = useState([]);
  const [currentStroke, setCurrentStroke] = useState(null);

  const colors = [C.navy, C.red, C.text, C.gold];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Engineering paper background — pale green-tinted base
    ctx.fillStyle = '#E8F0E2';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Grid: 4 minor squares per major square (classic engineering pad)
    const minorSize = 12;
    const majorSize = minorSize * 4;

    // Minor grid lines — light
    ctx.strokeStyle = 'rgba(76, 130, 80, 0.25)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x <= rect.width; x += minorSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
    }
    for (let y = 0; y <= rect.height; y += minorSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
    }
    ctx.stroke();

    // Major grid lines — darker
    ctx.strokeStyle = 'rgba(76, 130, 80, 0.55)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let x = 0; x <= rect.width; x += majorSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
    }
    for (let y = 0; y <= rect.height; y += majorSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
    }
    ctx.stroke();

    strokes.forEach(stroke => drawStroke(ctx, stroke));
    if (currentStroke) drawStroke(ctx, currentStroke);
  }, [strokes, currentStroke]);

  const drawStroke = (ctx, stroke) => {
    if (stroke.points.length < 2) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < stroke.points.length; i++) {
      const p1 = stroke.points[i - 1];
      const p2 = stroke.points[i];
      ctx.lineWidth = (p2.pressure || 0.5) * 5 + 1;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  };

  const getPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches?.[0] || e;
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
      pressure: touch.force || e.pressure || 0.5,
    };
  };

  const handleStart = (e) => {
    e.preventDefault();
    setCurrentStroke({ color, points: [getPoint(e)] });
  };

  const handleMove = (e) => {
    if (!currentStroke) return;
    e.preventDefault();
    setCurrentStroke({ ...currentStroke, points: [...currentStroke.points, getPoint(e)] });
  };

  const handleEnd = () => {
    if (currentStroke) {
      setStrokes([...strokes, currentStroke]);
      setCurrentStroke(null);
    }
  };

  const handleSave = () => {
    onSave(canvasRef.current.toDataURL('image/png'));
  };

  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke(null);
  };

  const handleUndo = () => {
    setStrokes(strokes.slice(0, -1));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.white, display: 'flex', flexDirection: 'column', zIndex: 100 }}>
      <div style={{ background: C.navy, color: C.white, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onCancel} style={{ color: C.white }}><X size={22} /></button>
        <div className="font-display" style={{ flex: 1, fontSize: 16 }}>SKETCH</div>
        <button onClick={handleUndo} style={{ color: C.white, fontSize: 12, fontWeight: 700, padding: '6px 12px', border: `1px solid ${C.white}`, borderRadius: 4 }}>UNDO</button>
        <button onClick={handleClear} style={{ color: C.white, fontSize: 12, fontWeight: 700, padding: '6px 12px', border: `1px solid ${C.white}`, borderRadius: 4 }}>CLEAR</button>
        <button onClick={handleSave} style={{ background: C.red, color: C.white, fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 4 }}>SAVE</button>
      </div>

      <div style={{ background: C.cream, padding: 8, display: 'flex', gap: 8, justifyContent: 'center' }}>
        {colors.map(c => (
          <button key={c} onClick={() => setColor(c)} style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: color === c ? `3px solid ${C.gold}` : `1px solid ${C.border}` }} />
        ))}
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={handleStart}
        onPointerMove={handleMove}
        onPointerUp={handleEnd}
        onPointerLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        style={{ flex: 1, touchAction: 'none', background: '#E8F0E2', display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
};

// ============================================================
// MEASUREMENTS TAB
// ============================================================
const MeasurementsTab = ({ oppData, updateOppData }) => {
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');

  const addMeasurement = () => {
    if (!label.trim() || !value.trim()) return;
    const newMeasurement = {
      id: Date.now(),
      label: label.trim(),
      value: parseFloat(value),
      timestamp: new Date().toISOString(),
    };
    updateOppData({ measurements: [...oppData.measurements, newMeasurement] });
    setLabel('');
    setValue('');
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, padding: 12, borderRadius: 4, marginBottom: 16 }}>
        <input
          placeholder="Label (e.g., Driveway width)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{ width: '100%', padding: 12, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 14, marginBottom: 8 }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{ flex: 1, padding: 12, border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 14 }}
          />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: 0.5 }}>FEET</span>
          <button
            onClick={addMeasurement}
            style={{ background: C.red, color: C.white, padding: '12px 16px', borderRadius: 4, fontWeight: 700, fontSize: 12, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Plus size={16} /> ADD
          </button>
        </div>
      </div>

      {oppData.measurements.length === 0 ? (
        <EmptyState icon={Ruler} text="No measurements recorded yet" />
      ) : (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ background: C.navy, color: C.white, padding: '10px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
            <span>Measurement</span>
            <span>Feet</span>
          </div>
          {oppData.measurements.map((m, i) => (
            <div key={m.id} style={{ padding: '12px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: i % 2 === 0 ? C.white : C.offwhite }}>
              <div>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{m.label}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{new Date(m.timestamp).toLocaleString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="font-display" style={{ fontSize: 18, color: C.navy }}>{m.value.toFixed(2)}'</span>
                <button onClick={() => updateOppData({ measurements: oppData.measurements.filter(x => x.id !== m.id) })}>
                  <Trash2 size={14} color={C.muted} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// NOTES TAB — voice-to-markdown
// ============================================================
const NotesTab = ({ oppData, updateOppData }) => {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const recognitionRef = useRef(null);

  const startRecording = () => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Speech recognition is not supported in this browser. Use Safari on iOS/iPadOS for full support.');
      return;
    }
    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalText = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(finalText + interim);
    };

    recognition.onerror = (e) => console.error('Speech error:', e);
    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setRecording(false);
  };

  const formatAndSave = async () => {
    if (!transcript.trim()) return;
    setProcessing(true);

    // Mock formatting — in production this calls Claude API
    setTimeout(() => {
      const formatted = `# Site Visit Note\n**${new Date().toLocaleString()}**\n\n## Raw Observations\n\n${transcript.trim()}\n\n## Summary\n_Auto-formatted by AI from voice transcript_\n`;
      const newNote = {
        id: Date.now(),
        markdown: formatted,
        rawTranscript: transcript.trim(),
        timestamp: new Date().toISOString(),
      };
      updateOppData({ notes: [...oppData.notes, newNote] });
      setTranscript('');
      setProcessing(false);
    }, 1200);
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: C.white, border: `1px solid ${C.border}`, padding: 16, borderRadius: 4, marginBottom: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <button
            onClick={recording ? stopRecording : startRecording}
            style={{
              width: 80, height: 80, borderRadius: '50%',
              background: recording ? C.red : C.navy,
              color: C.white,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: recording ? `0 0 0 8px rgba(180,0,0,0.2)` : `0 4px 8px rgba(0,0,0,0.15)`,
              animation: recording ? 'pulse 1.5s infinite' : 'none',
            }}
          >
            {recording ? <Square size={28} fill={C.white} /> : <Mic size={32} />}
          </button>
          <style>{`@keyframes pulse { 0%, 100% { box-shadow: 0 0 0 8px rgba(180,0,0,0.2); } 50% { box-shadow: 0 0 0 16px rgba(180,0,0,0); } }`}</style>
          <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: recording ? C.red : C.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {recording ? 'Recording... tap to stop' : 'Tap to record'}
          </div>
        </div>

        {transcript && (
          <div style={{ background: C.offwhite, border: `1px solid ${C.border}`, padding: 12, borderRadius: 4, marginTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Live Transcript</div>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{transcript}</div>
          </div>
        )}

        {transcript && !recording && (
          <button
            onClick={formatAndSave}
            disabled={processing}
            style={{ width: '100%', background: C.red, color: C.white, padding: 14, borderRadius: 4, fontWeight: 700, fontSize: 13, marginTop: 12, letterSpacing: 0.5, opacity: processing ? 0.6 : 1 }}
          >
            {processing ? 'FORMATTING WITH AI...' : 'FORMAT & SAVE TO DROPBOX'}
          </button>
        )}
      </div>

      {oppData.notes.length === 0 ? (
        <EmptyState icon={Mic} text="No site notes recorded yet" />
      ) : (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 0.5, padding: '0 4px 8px', textTransform: 'uppercase' }}>
            Saved to site-notes.md
          </div>
          {oppData.notes.slice().reverse().map(note => (
            <div key={note.id} style={{ background: C.white, border: `1px solid ${C.border}`, padding: 14, borderRadius: 4, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.muted }}>
                  <Clock size={11} /> {new Date(note.timestamp).toLocaleString()}
                </div>
                <button onClick={() => updateOppData({ notes: oppData.notes.filter(n => n.id !== note.id) })}>
                  <Trash2 size={14} color={C.muted} />
                </button>
              </div>
              <pre style={{ fontSize: 12, color: C.text, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, lineHeight: 1.5 }}>{note.markdown}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// EMPTY STATE
// ============================================================
const EmptyState = ({ icon: Icon, text }) => (
  <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
    <Icon size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
    <div style={{ fontSize: 13 }}>{text}</div>
  </div>
);

// ============================================================
// ROOT APP
// ============================================================
export default function App() {
  const [opportunities] = useState(MOCK_OPPORTUNITIES);
  const [selected, setSelected] = useState(null);
  const [captureData, setCaptureData] = useState({});

  return (
    <>
      <FontImports />
      <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: C.offwhite, position: 'relative' }}>
        {selected ? (
          <OpportunityDetail
            opportunity={selected}
            onBack={() => setSelected(null)}
            captureData={captureData}
            setCaptureData={setCaptureData}
          />
        ) : (
          <OpportunitiesList opportunities={opportunities} onSelect={setSelected} />
        )}
      </div>
    </>
  );
}
