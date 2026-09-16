import React, { useState } from 'react'
import Geo3DViewer from './Geo3DViewer.jsx'
import Geo3DAIPanel from './Geo3DAIPanel.jsx'
import { validateScene, parseSceneScript } from '../utils/geo3dScene.js'
import { hasTeacherAccess } from '../auth/mockUsers.js'

/**
 * Trang làm việc 3D (Workbench):
 * - Hỗ trợ Chế độ cô lập (Focus Mode): hình 3D chiếm toàn bộ không gian, loại bỏ các
 *   thành phần gây xao nhãng.
 * - Các công cụ phụ (nhập prompt AI, cột mã JSON cho giáo viên) thu gọn thành các
 *   ngăn kéo (drawer) trượt mượt mà khi cần.
 */
export default function Geo3DWorkbench({ user }) {
  const canSeeCode = hasTeacherAccess(user?.role)

  const [scene,       setScene]       = useState(null)
  const [note,        setNote]        = useState('')
  const [warnings,    setWarnings]    = useState([])
  const [script,      setScript]      = useState('')     // chỉ dựng cho giáo viên
  const [scriptErr,   setScriptErr]   = useState(null)
  const [busy,        setBusy]        = useState(false)
  const [error,       setError]       = useState(null)
  const [editing,     setEditing]     = useState(true)   // ô nhập đang mở rộng hay thu lại
  const [isFocusMode, setIsFocusMode] = useState(false)  // Chế độ cô lập hình
  const [showDrawer,  setShowDrawer]  = useState(false)  // Drawer mã JSON giáo viên
  const [showPromptDrawer, setShowPromptDrawer] = useState(false) // Drawer nhập đề

  const handleResult = (data) => {
    const { scene: clean, warnings: w, error: err } = validateScene(data.scene)
    if (err) { setError(err); return }
    setScene(clean)
    setNote(data.note || '')
    setWarnings([...(data.warnings || []), ...w])
    setError(null)
    setEditing(false)
    setShowPromptDrawer(false)
    setIsFocusMode(true) // Tự động bật chế độ cô lập khi dựng xong hình
    if (canSeeCode) setScript(JSON.stringify(clean, null, 2))
  }

  const applyScript = () => {
    const { scene: clean, warnings: w, error: err } = parseSceneScript(script)
    if (err) { setScriptErr(err); return }
    setScriptErr(null)
    setWarnings(w)
    setScene(clean)
  }

  const handleSceneChange = (updated) => {
    setScene(updated)
    if (canSeeCode) setScript(JSON.stringify(updated, null, 2))
  }

  const toggleFocus = () => setIsFocusMode(v => !v)

  return (
    <div className={`g3d-workbench ${isFocusMode ? 'g3d-workbench--focus' : ''}`}>

      {/* Thanh prompt AI ở trên (khi không ở chế độ cô lập) */}
      {!isFocusMode && (
        <div className="g3d-prompt-bar">
          <Geo3DAIPanel
            onResult={handleResult}
            onError={setError}
            busy={busy}
            setBusy={setBusy}
            compact={!editing && !!scene}
            onExpand={() => setEditing(true)}
          />
          {error && <div className="g3d-ai-error">{error}</div>}
        </div>
      )}

      {/* Sân khấu 3D chính. Ở chế độ cô lập, các nút "Soạn đề bài", "Script JSON", "Thoát cô lập"
          nằm ngay trong thanh công cụ của viewer — trước đây là cụm nút nổi riêng ở góc trái,
          đè lên các nút Xoay / Nối điểm bên dưới. */}
      <div className="g3d-stage">
        <div className="g3d-stage-main">
          <Geo3DViewer
            scene={scene}
            isFocusMode={isFocusMode}
            onToggleFocus={toggleFocus}
            onOpenPrompt={() => {
              if (isFocusMode) setShowPromptDrawer(true)
              else setEditing(true)
            }}
            onOpenScript={() => setShowDrawer(true)}
            canSeeCode={canSeeCode}
            onSceneChange={handleSceneChange}
          />

          {busy && (
            <div className="g3d-busy">
              <span className="g3d-spinner g3d-spinner--lg" />
              AI đang dựng hình không gian…
            </div>
          )}

          {note && !busy && (
            <div className="g3d-note g3d-note--float">
              <span className="g3d-note-badge">Chú thích</span>
              <span className="g3d-note-text">{note}</span>
            </div>
          )}
        </div>

        {/* Cột JSON editor cho giáo viên (dạng sidebar cố định khi không cô lập) */}
        {canSeeCode && !isFocusMode && (
          <div className="g3d-editor">
            <div className="g3d-editor-section g3d-editor-section--grow">
              <div className="g3d-editor-label">Script JSON</div>
              <textarea
                className="g3d-textarea"
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder="Hình do AI dựng sẽ hiện ở đây. Sửa rồi bấm Vẽ hình."
                spellCheck={false}
                autoComplete="off"
              />
              {scriptErr && <div className="g3d-err">⚠ {scriptErr}</div>}
              <button className="g3d-apply-btn" onClick={applyScript}>▶ Vẽ hình</button>
            </div>

            {warnings.length > 0 && (
              <div className="g3d-warn">
                {warnings.map((w, i) => <div key={i}>• {w}</div>)}
              </div>
            )}

            <details className="g3d-guide">
              <summary>Hướng dẫn cú pháp</summary>
              <div className="g3d-guide-body">
                <div className="g3d-guide-row"><code>points</code> — id, x, y, z, color?, size?</div>
                <div className="g3d-guide-row"><code>segments</code> — from, to, dashed?, highlight?, color?, width?</div>
                <div className="g3d-guide-row"><code>midpoints</code> — id, of: ["A","B"]</div>
                <div className="g3d-guide-row"><code>faces</code> — id, points: ["A","B","C"], style: &#123;fill, opacity, stroke&#125;</div>
                <div className="g3d-guide-row"><code>vectors</code> — from, to, color?, label?</div>
                <div className="g3d-guide-row"><code>labels</code> — id/point, text?, dx?, dy?, color?, size?</div>
                <div className="g3d-guide-row">Trục: x ngang, <strong>y cao</strong>, z sâu.</div>
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Drawer trượt cho Script JSON (dùng khi ở Focus Mode) */}
      {canSeeCode && showDrawer && (
        <div className="g3d-drawer-backdrop" onClick={() => setShowDrawer(false)}>
          <div className="g3d-drawer-panel" onClick={e => e.stopPropagation()}>
            <div className="g3d-drawer-header">
              <div className="g3d-drawer-title">{'{ }'} Script JSON Hình 3D</div>
              <button className="g3d-drawer-close" onClick={() => setShowDrawer(false)}>✕</button>
            </div>
            <div className="g3d-drawer-body">
              <textarea
                className="g3d-textarea g3d-textarea--drawer"
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder="Hình do AI dựng sẽ hiện ở đây. Sửa rồi bấm Vẽ hình."
                spellCheck={false}
                autoComplete="off"
              />
              {scriptErr && <div className="g3d-err">⚠ {scriptErr}</div>}
              <button className="g3d-apply-btn" onClick={() => { applyScript(); setShowDrawer(false) }}>
                ▶ Vẽ hình
              </button>

              {warnings.length > 0 && (
                <div className="g3d-warn" style={{ marginTop: 12 }}>
                  {warnings.map((w, i) => <div key={i}>• {w}</div>)}
                </div>
              )}

              <details className="g3d-guide" style={{ marginTop: 14 }}>
                <summary>Hướng dẫn cú pháp</summary>
                <div className="g3d-guide-body">
                  <div className="g3d-guide-row"><code>points</code> — id, x, y, z, color?, size?</div>
                  <div className="g3d-guide-row"><code>segments</code> — from, to, dashed?, highlight?, color?, width?</div>
                  <div className="g3d-guide-row"><code>midpoints</code> — id, of: ["A","B"]</div>
                  <div className="g3d-guide-row"><code>faces</code> — id, points: ["A","B","C"], style: &#123;fill, opacity, stroke&#125;</div>
                  <div className="g3d-guide-row"><code>vectors</code> — from, to, color?, label?</div>
                  <div className="g3d-guide-row"><code>labels</code> — id/point, text?, dx?, dy?, color?, size?</div>
                  <div className="g3d-guide-row">Trục: x ngang, <strong>y cao</strong>, z sâu.</div>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* Drawer trượt cho Prompt AI (dùng khi ở Focus Mode) */}
      {showPromptDrawer && (
        <div className="g3d-drawer-backdrop" onClick={() => setShowPromptDrawer(false)}>
          <div className="g3d-drawer-prompt" onClick={e => e.stopPropagation()}>
            <div className="g3d-drawer-header">
              <div className="g3d-drawer-title">✨ Nhập đề bài hình học không gian</div>
              <button className="g3d-drawer-close" onClick={() => setShowPromptDrawer(false)}>✕</button>
            </div>
            <div className="g3d-drawer-body">
              <Geo3DAIPanel
                onResult={handleResult}
                onError={setError}
                busy={busy}
                setBusy={setBusy}
                compact={false}
              />
              {error && <div className="g3d-ai-error" style={{ marginTop: 10 }}>{error}</div>}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
