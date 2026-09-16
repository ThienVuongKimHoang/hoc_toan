import React, { useState } from 'react'
import Geo3DViewer from './Geo3DViewer.jsx'
import Geo3DAIPanel from './Geo3DAIPanel.jsx'
import { validateScene, parseSceneScript } from '../utils/geo3dScene.js'
import { hasTeacherAccess } from '../auth/mockUsers.js'

/**
 * Trang vẽ hình: ô nhập AI ở trên, hình 3D ở giữa, cột soạn JSON bên phải.
 *
 * Cột JSON CHỈ dựng cho giáo viên và admin. Với học sinh, đoạn mã thậm chí không được
 * đưa vào state — xem `canSeeCode` bên dưới.
 *
 * Lưu ý: đây là chuyện GIAO DIỆN, không phải bảo mật. Cảnh JSON vẫn phải xuống trình
 * duyệt thì mới vẽ được, vẫn nhìn thấy trong tab Network. Mục tiêu thật chỉ là không
 * dí đoạn mã vào mặt học sinh lớp 11-12, nên đừng thêm mã hoá hay che giấu gì nữa.
 */
export default function Geo3DWorkbench({ user }) {
  const canSeeCode = hasTeacherAccess(user?.role)

  const [scene,    setScene]    = useState(null)
  const [note,     setNote]     = useState('')
  const [warnings, setWarnings] = useState([])
  const [script,   setScript]   = useState('')     // chỉ dựng cho giáo viên
  const [scriptErr, setScriptErr] = useState(null)
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState(null)
  const [editing,  setEditing]  = useState(true)   // ô nhập đang mở rộng hay đã thu lại

  const handleResult = (data) => {
    // Kiểm tra lần hai ở trình duyệt: server đã lọc rồi, nhưng đây là lớp chặn cuối
    // trước khi đưa vào canvas.
    const { scene: clean, warnings: w, error: err } = validateScene(data.scene)
    if (err) { setError(err); return }
    setScene(clean)
    setNote(data.note || '')
    setWarnings([...(data.warnings || []), ...w])
    setError(null)
    setEditing(false)
    if (canSeeCode) setScript(JSON.stringify(clean, null, 2))
  }

  const applyScript = () => {
    const { scene: clean, warnings: w, error: err } = parseSceneScript(script)
    if (err) { setScriptErr(err); return }
    setScriptErr(null)
    setWarnings(w)
    setScene(clean)
  }

  return (
    <div className="g3d-workbench">

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

      <div className="g3d-stage">
        <div className="g3d-stage-main">
          <Geo3DViewer scene={scene} />
          {busy && (
            <div className="g3d-busy">
              <span className="g3d-spinner g3d-spinner--lg" />
              AI đang dựng hình…
            </div>
          )}
          {note && !busy && <div className="g3d-note">{note}</div>}
        </div>

        {canSeeCode && (
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
    </div>
  )
}
