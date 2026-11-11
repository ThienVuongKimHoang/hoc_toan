import React, { useEffect, useRef, useState } from 'react'
import { exportDocument } from '../../store/imageConvertStore.js'
import { SAVE_LABEL, itemFromFile, useImageConvertSession } from '../../store/useImageConvertSession.js'
import ImageConvertEditor from '../ImageConvertEditor.jsx'
import { FORMATS, FormatPicker, PageList } from '../ImageConvertParts.jsx'

const WORD_FORMATS = FORMATS.filter(f => f.value !== 'latex')

/* Bước "File Word" khi tạo đề từ ảnh: nhận dạng từng trang, sửa trong khung 3 cột, tải Word.
   Nếu cũng chọn lưu thành đề thì nội dung đã sửa ở đây được dùng để tách câu hỏi,
   khỏi gọi AI đọc ảnh thêm lần nữa. */
export default function ImageWordStep({ files, makeExam, onCreateExam, onFinish, errorFromPrev }) {
  const {
    items, converting, saveState, flushSaves, updateMarkdown, convert,
  } = useImageConvertSession({ initialItems: () => files.map(itemFromFile) })
  const [format, setFormat] = useState('docx')
  const [exporting, setExporting] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')

  // Vào bước này là nhận dạng luôn, người dùng đã bấm Bắt đầu ở bước trước.
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    convert()
  }, [convert])

  const doneCount = items.filter(it => it.status === 'done').length
  const failed = items.filter(it => it.status === 'error').length
  const allDone = doneCount === items.length
  const busy = converting || exporting

  const download = async () => {
    setExporting(true)
    setError('')
    try {
      await exportDocument(format, items.filter(it => it.status === 'done')
        .map(({ result }) => ({ markdown: result.markdown, figures: result.figures })))
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  const createExam = async () => {
    await flushSaves()
    onCreateExam(items.map(it => it.file), items.map(it => it.result.markdown))
  }

  const shownError = error || errorFromPrev?.message

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '16px 0' }}>
      <div style={{ fontSize: 14, color: '#475569' }}>
        {converting
          ? `Đang nhận dạng ${doneCount}/${items.length} trang, mỗi trang khoảng nửa phút…`
          : allDone
            ? 'Đã nhận dạng xong. Bấm Chỉnh sửa để đối chiếu với ảnh gốc và sửa trước khi tải.'
            : `${failed} trang chưa nhận dạng được, bấm Nhận dạng lại để thử tiếp.`}
      </div>

      <PageList items={items} onEdit={setEditingId} />

      <FormatPicker formats={WORD_FORMATS} value={format} onChange={setFormat} name="exam-word-format" />

      {shownError && <div role="alert" style={{ marginTop: 12, color: '#b91c1c', fontSize: 14 }}>{shownError}</div>}

      <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {!converting && !allDone && (
          <button className="btn-primary" onClick={convert}>Nhận dạng lại {failed} trang</button>
        )}
        <button className="btn-primary" onClick={download} disabled={busy || doneCount === 0}>
          {exporting ? 'Đang tạo file…' : 'Tải file Word'}
        </button>
        {makeExam ? (
          <button className="btn-primary" onClick={createExam} disabled={busy || !allDone}
            title={allDone ? undefined : 'Cần nhận dạng xong tất cả các trang'}>
            Tiếp tục tạo đề từ nội dung này
          </button>
        ) : (
          <button type="button" className="cm-tab" onClick={onFinish} disabled={busy}>Xong, quay lại lớp</button>
        )}
      </div>
      <p style={{ fontSize: 13, color: '#64748b', marginTop: 12, textAlign: 'center' }}>
        Nội dung do AI đọc từ ảnh nên có thể sai sót.
        {makeExam && ' Phần bạn sửa ở đây cũng được dùng để tạo đề.'}
        {SAVE_LABEL[saveState] && ` ${SAVE_LABEL[saveState]}.`}
      </p>

      {editingId && items.some(it => it.id === editingId && it.status === 'done') && (
        <ImageConvertEditor
          pages={items.filter(it => it.status === 'done')}
          currentId={editingId}
          saveLabel={SAVE_LABEL[saveState]}
          onSelect={setEditingId}
          onChange={updateMarkdown}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}
