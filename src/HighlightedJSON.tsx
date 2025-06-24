import React, { useEffect, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';

export function HighlightedJSON({ json, selectedId }: { json: any; selectedId: string | null }) {
  const editorRef = useRef<any>(null);
  const jsonStr = JSON.stringify(json, null, 2);
  // Find the start/end lines for the selected block
  let highlightStartLine = -1;
  let highlightEndLine = -1;
  if (selectedId && json.layers) {
    for (const layer of json.layers) {
      if (layer.id === selectedId) {
        const block = JSON.stringify(layer, null, 2);
        const lines = jsonStr.split('\n');
        const blockLines = block.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines.slice(i, i + blockLines.length).join('\n') === block) {
            highlightStartLine = i + 1; // Monaco is 1-based
            highlightEndLine = i + blockLines.length;
            break;
          }
        }
        break;
      }
    }
  }
  useEffect(() => {
    if (editorRef.current && highlightStartLine !== -1) {
      editorRef.current.revealLineInCenter(highlightStartLine);
      editorRef.current.deltaDecorations([], [
        {
          range: {
            startLineNumber: highlightStartLine,
            endLineNumber: highlightEndLine,
            startColumn: 1,
            endColumn: 1000,
          },
          options: {
            inlineClassName: 'json-block-highlight',
            isWholeLine: true,
          },
        },
      ]);
    }
  }, [selectedId, highlightStartLine, highlightEndLine]);
  function handleEditorDidMount(editor: any /*, monaco: any */) {
    editorRef.current = editor;
  }
  return (
    <div style={{ height: 400, minHeight: 200 }}>
      <MonacoEditor
        height="100%"
        defaultLanguage="json"
        value={jsonStr}
        options={{ readOnly: true, minimap: { enabled: false }, fontSize: 14, lineNumbers: 'on', scrollBeyondLastLine: false }}
        onMount={handleEditorDidMount}
        theme="vs-dark"
      />
      <style>{`.json-block-highlight { background: #2962ff !important; color: #fff !important; font-weight: bold; border-radius: 4px; }`}</style>
    </div>
  );
}
