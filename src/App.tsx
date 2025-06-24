import React, { useState, useEffect, useRef } from 'react';
import { Player } from '@remotion/player';
import './App.css';
import { HighlightedJSON } from './HighlightedJSON';

// Types for template
interface Layer {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio';
  src?: string;
  start: number;
  end: number;
  track: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}
interface Template {
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  layers: Layer[];
}

const LAYER_TYPES = [
  { type: 'image', icon: '🖼️', label: 'Image' },
  { type: 'video', icon: '🎬', label: 'Video' },
  { type: 'audio', icon: '🔊', label: 'Audio' },
];
const FORMAT_PRESETS = [
  { label: 'YouTube Short (9:16)', width: 720, height: 1280 },
  { label: 'HD 16:9 (1920x1080)', width: 1920, height: 1080 },
  { label: 'HD 9:16 (1080x1920)', width: 1080, height: 1920 },
  { label: 'Square (1:1)', width: 1080, height: 1080 },
  { label: 'Standard 16:9 (1280x720)', width: 1280, height: 720 },
];

// Remotion composition that renders from template JSON
function TemplateVideo({ template }: { template: Template }) {
  return (
    <div style={{ width: template.width, height: template.height, position: 'relative', background: '#111' }}>
      {template.layers.map((layer) => {
        if (layer.type === 'image' && layer.src) {
          return (
            <img key={layer.id} src={layer.src} style={{ position: 'absolute', left: layer.x, top: layer.y, width: layer.width, height: layer.height, objectFit: 'contain', border: selectedId === layer.id ? '3px solid #f44' : undefined }} alt={layer.name} />
          );
        }
        if (layer.type === 'video' && layer.src) {
          return (
            <video key={layer.id} src={layer.src} style={{ position: 'absolute', left: layer.x, top: layer.y, width: layer.width, height: layer.height, objectFit: 'contain', border: selectedId === layer.id ? '3px solid #f44' : undefined }} controls={false} autoPlay loop muted />
          );
        }
        if (layer.type === 'audio' && layer.src) {
          return (
            <audio key={layer.id} src={layer.src} controls={false} autoPlay style={{ display: 'none' }} />
          );
        }
        return null;
      })}
    </div>
  );
}

function Sidebar({ layers, selectedId, onSelect, onTypeSelect, selectedType }: { layers: Layer[]; selectedId: string | null; onSelect: (id: string) => void; onTypeSelect: (type: string) => void; selectedType: string }) {
  return (
    <div style={{ width: 160, background: '#222', color: '#fff', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {LAYER_TYPES.map((lt) => (
          <button
            key={lt.type}
            onClick={() => {
              onTypeSelect(lt.type);
            }}
            style={{
              background: selectedType === lt.type ? '#f44' : '#333',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontSize: 20,
              padding: '4px 10px',
              cursor: 'pointer',
              outline: selectedType === lt.type ? '2px solid #f44' : 'none',
            }}
            title={lt.label}
          >
            {lt.icon}
          </button>
        ))}
      </div>
      {layers.map((layer) => (
        <div key={layer.id} onClick={() => onSelect(layer.id)} style={{ padding: 8, borderRadius: 4, background: selectedId === layer.id ? '#444' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, border: selectedId === layer.id || selectedType === layer.type ? '2px solid #f44' : '2px solid transparent' }}>
          <span>{LAYER_TYPES.find(lt => lt.type === layer.type)?.icon}</span>
          <span>{layer.name}</span>
          <span style={{ fontSize: 12, color: '#aaa' }}>({layer.type})</span>
        </div>
      ))}
    </div>
  );
}

function PropertiesPanel({ layer }: { layer: Layer | undefined }) {
  if (!layer) return <div style={{ color: '#aaa' }}>Select a layer</div>;
  return (
    <div style={{ padding: 16 }}>
      <h3>Properties</h3>
      <div><b>Name:</b> {layer.name}</div>
      <div><b>Type:</b> {layer.type}</div>
      {layer.src && <div><b>Source:</b> <a href={layer.src} target="_blank" rel="noopener noreferrer">{layer.src}</a></div>}
      <div><b>Start:</b> {layer.start}</div>
      <div><b>End:</b> {layer.end}</div>
      <div><b>Track:</b> {layer.track + 1}</div>
      <div><b>ID:</b> {layer.id}</div>
    </div>
  );
}

function Timeline({ layers, duration, selectedId, selectedType, onSelect, onLayerUpdate, onLayerTrackChange, playhead, onPlayheadChange }: { layers: Layer[]; duration: number; selectedId: string | null; selectedType: string; onSelect: (id: string) => void; onLayerUpdate: (id: string, start: number, end: number) => void; onLayerTrackChange: (id: string, newTrack: number) => void; playhead: number; onPlayheadChange: (frame: number) => void }) {
  const dragging = useRef<{ id: string; type: 'move' | 'resize-start' | 'resize-end' | 'move-track'; startX: number; startY: number; origStart: number; origEnd: number; origTrack: number } | null>(null);
  const playheadDrag = useRef(false);

  function onMouseDown(e: React.MouseEvent, id: string, type: 'move' | 'resize-start' | 'resize-end' | 'move-track') {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    dragging.current = {
      id,
      type,
      startX: e.clientX,
      startY: e.clientY,
      origStart: layer.start,
      origEnd: layer.end,
      origTrack: layer.track,
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
  function onMouseMove(e: MouseEvent) {
    if (playheadDrag.current) {
      const frame = Math.max(0, Math.round(e.clientX / 8));
      onPlayheadChange(frame);
      return;
    }
    if (!dragging.current) return;
    const { id, type, startX, startY, origStart, origEnd, origTrack } = dragging.current;
    const delta = Math.round((e.clientX - startX) / 8);
    const deltaY = (e.clientY - startY) / 30;
    if (type === 'move') {
      // Allow free movement, including overlaps
      let newTrack = Math.round(origTrack + deltaY);
      if (newTrack < 0) newTrack = 0;
      onLayerUpdate(id, Math.max(0, origStart + delta), Math.max(0, origEnd + delta));
      onLayerTrackChange(id, newTrack);
    } else if (type === 'resize-start') {
      onLayerUpdate(id, Math.max(0, origStart + delta), origEnd);
    } else if (type === 'resize-end') {
      onLayerUpdate(id, origStart, Math.max(origStart + 1, origEnd + delta));
    } else if (type === 'move-track') {
      let newTrack = Math.round(origTrack + deltaY);
      if (newTrack < 0) newTrack = 0;
      onLayerTrackChange(id, newTrack);
    }
  }
  function onMouseUp() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    dragging.current = null;
    playheadDrag.current = false;
  }
  const maxTrack = Math.max(2, ...layers.map(l => l.track));
  const seconds = Math.ceil(duration / 30);
  return (
    <div style={{ height: (maxTrack + 1) * 30 + 60, background: '#222', color: '#fff', padding: 8, overflowX: 'auto', position: 'relative', userSelect: dragging.current || playheadDrag.current ? 'none' : 'auto' }}>
      {/* Ruler */}
      <div style={{ position: 'absolute', left: 0, top: 0, height: 30, width: duration * 8, borderBottom: '1px solid #444', display: 'flex', alignItems: 'flex-end' }}>
        {Array.from({ length: seconds + 1 }).map((_, i) => (
          <div key={i} style={{ position: 'absolute', left: i * 30 * 8, width: 1, height: 20, background: '#aaa' }} />
        ))}
        {Array.from({ length: seconds * 10 }).map((_, i) => (
          <div key={i} style={{ position: 'absolute', left: i * 3 * 8, width: 1, height: 10, background: '#555' }} />
        ))}
        {Array.from({ length: seconds + 1 }).map((_, i) => (
          <span key={i} style={{ position: 'absolute', left: i * 30 * 8 + 2, top: 10, fontSize: 12, color: '#fff' }}>{i}s</span>
        ))}
      </div>
      {/* Playhead (needle) */}
      <div
        style={{ position: 'absolute', left: playhead * 8 - 6, top: 0, width: 12, height: (maxTrack + 1) * 30 + 60, zIndex: 10, cursor: 'ew-resize', background: 'none' }}
        onMouseDown={() => {
          playheadDrag.current = true;
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
        }}
      >
        <div style={{ width: 12, height: 24, background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 12, height: 12, background: '#f44', borderRadius: 6, border: '2px solid #fff', margin: '0 auto' }} />
        </div>
        <div style={{ width: 2, height: (maxTrack + 1) * 30 + 36, background: '#f44', margin: '0 auto' }} />
      </div>
      {/* Tracks */}
      {Array.from({ length: maxTrack + 1 }).map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: 0, top: 30 * (i + 1), height: 24, width: 60, color: '#aaa', fontSize: 12, pointerEvents: 'none' }}>Track {i + 1}</div>
      ))}
      {/* Layer blocks - allow overlap, use zIndex and opacity for stacking */}
      {layers.map((layer, idx) => (
        <div key={layer.id} style={{
          position: 'absolute',
          left: layer.start * 8,
          top: (layer.track + 1) * 30,
          width: (layer.end - layer.start) * 8,
          height: 24,
          background: (selectedId === layer.id || selectedType === layer.type) ? '#f44' : '#888',
          borderRadius: 12,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 8,
          zIndex: 100 + idx,
          border: (selectedId === layer.id || selectedType === layer.type) ? '2px solid #fff' : '2px solid transparent',
          color: '#fff',
          fontWeight: 600,
          opacity: selectedId === layer.id ? 1 : 0.85,
          boxShadow: '0 2px 8px #0006',
        }}
        onClick={() => onSelect(layer.id)}
        >
          <div
            style={{ width: 8, height: 24, cursor: 'ew-resize', background: '#222', borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }}
            onMouseDown={e => { e.stopPropagation(); onMouseDown(e, layer.id, 'resize-start'); }}
          />
          <div style={{ flex: 1 }} onMouseDown={e => { e.stopPropagation(); onMouseDown(e, layer.id, 'move'); }}>{layer.name} <span style={{ fontSize: 12, color: '#fff' }}>({layer.type})</span></div>
          <div
            style={{ width: 8, height: 24, cursor: 'ew-resize', background: '#222', borderTopRightRadius: 12, borderBottomRightRadius: 12 }}
            onMouseDown={e => { e.stopPropagation(); onMouseDown(e, layer.id, 'resize-end'); }}
          />
          <div
            style={{ width: 8, height: 24, cursor: 'ns-resize', background: '#333', borderRadius: 4, marginLeft: 4 }}
            title="Move to another track"
            onMouseDown={e => { e.stopPropagation(); onMouseDown(e, layer.id, 'move-track'); }}
          />
        </div>
      ))}
    </div>
  );
}

function App() {
  const [template, setTemplate] = useState<Template | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState('');
  const [json, setJson] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [jsonPanelWidth, setJsonPanelWidth] = useState(400);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pendingHighlightType, setPendingHighlightType] = useState<string | null>(null);
  const resizingJson = useRef(false);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    fetch('src/sample-template.json')
      .then((res) => res.json())
      .then((data) => {
        setTemplate(data);
        setJson(JSON.stringify(data, null, 2));
      });
  }, []);

  const selectedLayer = template?.layers.find((l) => l.id === selectedId);

  function handleLayerUpdate(id: string, start: number, end: number) {
    if (!template) return;
    const layers = template.layers.map(l => l.id === id ? { ...l, start, end } : l);
    const updated = { ...template, layers };
    setTemplate(updated);
    setJson(JSON.stringify(updated, null, 2));
  }
  function handleLayerTrackChange(id: string, newTrack: number) {
    if (!template) return;
    const layers = template.layers.map(l => l.id === id ? { ...l, track: newTrack } : l);
    const updated = { ...template, layers };
    setTemplate(updated);
    setJson(JSON.stringify(updated, null, 2));
  }
  function onJsonPanelMouseDown(e: React.MouseEvent) {
    resizingJson.current = true;
    const startX = e.clientX;
    const startWidth = jsonPanelWidth;
    function onMove(ev: MouseEvent) {
      setJsonPanelWidth(Math.max(300, startWidth + (ev.clientX - startX)));
    }
    function onUp() {
      resizingJson.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }
  function handleFormatChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!template) return;
    const preset = FORMAT_PRESETS[parseInt(e.target.value, 10)];
    const updated = { ...template, width: preset.width, height: preset.height };
    setTemplate(updated);
    setJson(JSON.stringify(updated, null, 2));
  }
  // Playhead logic
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPlayhead((p) => {
        if (!template) return 0;
        if (p < template.durationInFrames - 1) return p + 1;
        setIsPlaying(false);
        return p;
      });
    }, 1000 / (template?.fps || 30));
    return () => clearInterval(interval);
  }, [isPlaying, template]);
  // Sync Remotion Player with playhead
  useEffect(() => {
    if (playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(playhead);
    }
  }, [playhead]);
  // Highlight layer in JSON panel when type button is clicked
  useEffect(() => {
    if (showJson && pendingHighlightType) {
      const layer = template?.layers.find(l => l.type === pendingHighlightType);
      if (layer) setSelectedId(layer.id);
      setPendingHighlightType(null);
    }
  }, [showJson, pendingHighlightType, template]);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#181818', color: '#fff', position: 'relative' }}>
      <Sidebar layers={template?.layers || []} selectedId={selectedId} onSelect={id => { setSelectedId(id); setSelectedType(template?.layers.find(l => l.id === id)?.type || ''); }} onTypeSelect={type => {
        setSelectedType(type);
        if (!showJson) {
          setPendingHighlightType(type);
          setShowJson(true);
        } else {
          // If JSON is already open, select the first layer of that type
          const layer = template?.layers.find(l => l.type === type);
          if (layer) setSelectedId(layer.id);
        }
      }} selectedType={selectedType} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flex: 1 }}>
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#111', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ color: '#fff', fontWeight: 600, marginRight: 8 }}>Format:</label>
              <select onChange={handleFormatChange} style={{ fontSize: 16, padding: 4, borderRadius: 4 }}>
                {FORMAT_PRESETS.map((preset, i) => (
                  <option key={preset.label} value={i}>{preset.label}</option>
                ))}
              </select>
              <button onClick={() => setShowJson(v => !v)} style={{ fontSize: 18, padding: '2px 10px', borderRadius: 4, background: showJson ? '#4af' : '#222', color: '#fff', border: '1px solid #444', cursor: 'pointer' }} title="Show/Hide JSON">{'{}'}</button>
            </div>
            {template && (
              <PlayerErrorBoundary>
                <Player
                  ref={playerRef}
                  component={({ template }) => (
                    <div style={{ width: template.width, height: template.height, position: 'relative', background: '#111' }}>
                      {template.layers.map((layer) => {
                        if (layer.type === 'image' && layer.src) {
                          return (
                            <img key={layer.id} src={layer.src} style={{ position: 'absolute', left: layer.x, top: layer.y, width: layer.width, height: layer.height, objectFit: 'contain', border: selectedId === layer.id ? '3px solid #f44' : undefined }} alt={layer.name} />
                          );
                        }
                        if (layer.type === 'video' && layer.src) {
                          return (
                            <video key={layer.id} src={layer.src} style={{ position: 'absolute', left: layer.x, top: layer.y, width: layer.width, height: layer.height, objectFit: 'contain', border: selectedId === layer.id ? '3px solid #f44' : undefined }} controls={false} autoPlay loop muted />
                          );
                        }
                        if (layer.type === 'audio' && layer.src) {
                          return (
                            <audio key={layer.id} src={layer.src} controls={false} autoPlay style={{ display: 'none' }} />
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                  inputProps={{ template, playhead }}
                  durationInFrames={template.durationInFrames}
                  compositionWidth={template.width}
                  compositionHeight={template.height}
                  fps={template.fps}
                  controls={false}
                  style={{ borderRadius: 8, boxShadow: '0 2px 8px #0008', margin: 24 }}
                />
              </PlayerErrorBoundary>
            )}
          </div>
          <div style={{ flex: 1, background: '#222', minWidth: 220 }}>
            <div style={{ padding: 16 }}>
              <h3>Properties</h3>
              {selectedLayer ? (
                <>
                  <div><b>Name:</b> {selectedLayer.name}</div>
                  <div><b>Type:</b> {selectedLayer.type}</div>
                  {selectedLayer.src && <div><b>Source:</b> <a href={selectedLayer.src} target="_blank" rel="noopener noreferrer">{selectedLayer.src}</a></div>}
                  <div><b>Start:</b> {selectedLayer.start}</div>
                  <div><b>End:</b> {selectedLayer.end}</div>
                  <div><b>Track:</b> {selectedLayer.track + 1}</div>
                  <div><b>ID:</b> {selectedLayer.id}</div>
                </>
              ) : <div style={{ color: '#aaa' }}>Select a layer</div>}
            </div>
          </div>
        </div>
        {/* Playback controls */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#222', padding: '8px 16px', borderTop: '1px solid #333', gap: 12 }}>
          <button onClick={() => setPlayhead(0)} style={{ fontSize: 20, background: '#333', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 10px', cursor: 'pointer' }} title="Rewind">|&lt;</button>
          <button onClick={() => setIsPlaying(p => !p)} style={{ fontSize: 20, background: '#333', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 10px', cursor: 'pointer' }} title={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? '⏸' : '▶️'}</button>
          <span style={{ color: '#fff', fontWeight: 600 }}>{(playhead / (template?.fps || 30)).toFixed(2)}s</span>
        </div>
        {/* Timeline and controls */}
        <Timeline
          layers={template?.layers || []}
          duration={template?.durationInFrames || 0}
          selectedId={selectedId}
          selectedType={selectedType}
          onSelect={id => { setSelectedId(id); setSelectedType(template?.layers.find(l => l.id === id)?.type || ''); }}
          onLayerUpdate={handleLayerUpdate}
          onLayerTrackChange={handleLayerTrackChange}
          playhead={playhead}
          onPlayheadChange={setPlayhead}
        />
        {/* JSON panel below timeline */}
        {showJson && template && (
          <div style={{ width: '100%', background: '#181818', padding: 0, borderTop: '1px solid #333', minHeight: 200 }}>
            <h3 style={{ color: '#fff', margin: '8px 0 0 16px' }}>Template JSON</h3>
            <div style={{ padding: 8 }}>
              <HighlightedJSON json={template} selectedId={selectedId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<Error | null>(null);
  if (error) {
    return (
      <div style={{ color: 'red', background: '#222', padding: 24, borderRadius: 8, margin: 24, fontSize: 18 }}>
        <b>Remotion Player failed to load:</b>
        <br />
        {error.message}
      </div>
    );
  }
  return (
    <React.Suspense fallback={<div style={{ color: '#fff', padding: 24 }}>Loading video preview...</div>}>
      <ErrorCatcher onError={setError}>{children}</ErrorCatcher>
    </React.Suspense>
  );
}
function ErrorCatcher({ children, onError }: { children: React.ReactNode; onError: (e: Error) => void }) {
  try {
    return <>{children}</>;
  } catch (e: any) {
    onError(e);
    return null;
  }
}

export default App;
