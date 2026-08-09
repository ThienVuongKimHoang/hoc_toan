import { useState, useEffect, useMemo, useCallback } from 'react'
import { vocabulary, categories } from '../data/vocabulary.js'
import * as vocabStore from '../store/vocabStore.js'
import WordCard from '../components/WordCard.jsx'
import WordModal from '../components/WordModal.jsx'
import QuizMode from '../components/QuizMode.jsx'
import FillBlankPractice from '../components/FillBlankPractice.jsx'
import {
  IconArrowLeft, IconBook, IconSearch, IconX, IconTarget, IconPencil,
  IconBookmark, IconTrash, IconCheck,
} from '../components/VocabIcons.jsx'

// ====== Màu sắc & font (design tokens — "Academic Navy + Gold", đồng bộ với HomePage.jsx) ======
const C = {
  bg: '#FAFCFF', cream2: '#F1F5F9', ink: '#0F172A', sub: '#475569',
  accent: '#FBBF24', accentDark: '#B45309', badgeBg: '#E0EEFF', badgeText: '#1E40AF',
  border: '#E2E8F0', dark: '#0F172A', darkSub: '#94A3B8', blue: '#3B82F6', teal: '#10B981',
}
const DISPLAY = "'Baloo 2', 'Be Vietnam Pro', sans-serif"

const PAGE_SIZE = 40

export default function VocabPage({ user, onBack }) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedWord, setSelectedWord] = useState(null)
  const [page, setPage] = useState(1)
  const [progress, setProgress] = useState({})
  const [showQuiz, setShowQuiz] = useState(false)
  const [showFillBlank, setShowFillBlank] = useState(false)
  const [showQueuePanel, setShowQueuePanel] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    let alive = true
    vocabStore.getVocabProgress().then(rows => {
      if (!alive) return
      const map = {}
      for (const r of rows) map[r.wordId] = r
      setProgress(map)
    })
    return () => { alive = false }
  }, [])

  function showToast(msg, type = 'info') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const queueIds = useMemo(
    () => new Set(Object.values(progress).filter(p => p.inQueue).map(p => p.wordId)),
    [progress]
  )
  const queueFull = useMemo(() => vocabulary.filter(w => queueIds.has(w.id)), [queueIds])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return vocabulary.filter(w => {
      const matchCat = activeCategory === 'all' || w.category === activeCategory
      const matchSearch = !q || w.word.toLowerCase().includes(q) || w.vietnamese.toLowerCase().includes(q)
      return matchCat && matchSearch
    })
  }, [search, activeCategory])

  useEffect(() => { setPage(1) }, [search, activeCategory])

  const paginated = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = paginated.length < filtered.length

  const toggleQueue = useCallback((word) => {
    setProgress(prev => {
      const cur = prev[word.id] || { wordId: word.id, correctCount: 0, wrongCount: 0 }
      return { ...prev, [word.id]: { ...cur, inQueue: !cur.inQueue } }
    })
    vocabStore.setQueueMembership(word.id, !queueIds.has(word.id))
  }, [queueIds])

  const recordResult = useCallback((wordId, correct) => {
    setProgress(prev => {
      const cur = prev[wordId] || { wordId, inQueue: false, correctCount: 0, wrongCount: 0 }
      return { ...prev, [wordId]: { ...cur, correctCount: cur.correctCount + (correct ? 1 : 0), wrongCount: cur.wrongCount + (correct ? 0 : 1) } }
    })
    vocabStore.recordResult(wordId, correct)
  }, [])

  function handleRemoveFromQueue(wordId) {
    setProgress(prev => prev[wordId] ? { ...prev, [wordId]: { ...prev[wordId], inQueue: false } } : prev)
    vocabStore.setQueueMembership(wordId, false)
  }

  function handleClearQueue() {
    setProgress(prev => {
      const next = {}
      for (const [id, p] of Object.entries(prev)) next[id] = { ...p, inQueue: false }
      return next
    })
    vocabStore.clearQueue()
  }

  function handleStartQuiz() {
    if (queueFull.length < 2) { showToast('Cần ít nhất 2 từ trong hàng ôn tập để bắt đầu!', 'error'); return }
    setShowQuiz(true)
    setShowQueuePanel(false)
  }

  return (
    <div className="tool-page">
      <div className="tool-page-topbar">
        <button className="tool-page-back" onClick={onBack}>
          <IconArrowLeft size={16} sw={2.2} /> Quay lại
        </button>
        <span className="tool-page-title">
          <IconBook size={18} /> Ôn luyện IELTS · Từ vựng
        </span>
      </div>

      <div className="tool-page-content">
        <div className="vp-scroll">
          <div className="vp-wrap">
            <div className="vp-top">
              <div className="vp-stats">
                <div className="vp-stat"><b>{vocabulary.length}</b><span>Từ vựng</span></div>
                <div className="vp-stat"><b>{categories.length - 1}</b><span>Chủ đề</span></div>
              </div>
              <div className="vp-actions">
                <button className={`vp-btn vp-btn--ghost${queueFull.length > 0 ? ' has-badge' : ''}`} onClick={() => setShowQueuePanel(v => !v)}>
                  <IconBookmark size={15} /> Ôn tập
                  {queueFull.length > 0 && <span className="vp-badge">{queueFull.length}</span>}
                </button>
                <button className="vp-btn vp-btn--ghost" onClick={() => setShowFillBlank(true)} disabled={queueFull.length < 1}>
                  <IconPencil size={15} /> Điền chỗ trống
                </button>
                <button className="vp-btn vp-btn--primary" onClick={handleStartQuiz} disabled={queueFull.length < 2}>
                  <IconTarget size={15} /> Kiểm tra
                </button>
              </div>
            </div>

            {showQueuePanel && (
              <div className="vp-queue-panel">
                <div className="vp-queue-panel-head">
                  <h3>Hàng ôn tập ({queueFull.length} từ)</h3>
                  <div className="vp-queue-panel-actions">
                    {queueFull.length > 0 && (
                      <>
                        <button className="vp-btn vp-btn--sm vp-btn--primary" onClick={handleStartQuiz}><IconTarget size={13} /> Kiểm tra ngay</button>
                        <button className="vp-btn vp-btn--sm vp-btn--ghost" onClick={handleClearQueue}><IconTrash size={13} /> Xoá hết</button>
                      </>
                    )}
                    <button className="vp-icon-btn" onClick={() => setShowQueuePanel(false)} aria-label="Đóng"><IconX size={16} /></button>
                  </div>
                </div>
                {queueFull.length === 0 ? (
                  <p className="vp-queue-empty">Chưa có từ nào. Bấm vào một từ và chọn "Thêm vào ôn" trong chi tiết từ.</p>
                ) : (
                  <div className="vp-queue-list">
                    {queueFull.map(w => (
                      <div className="vp-queue-item" key={w.id}>
                        <span className="vp-qi-word">{w.word}</span>
                        <span className="vp-qi-viet">{w.vietnamese}</span>
                        <button className="vp-icon-btn vp-icon-btn--sm" onClick={() => handleRemoveFromQueue(w.id)} aria-label="Xoá khỏi hàng ôn">
                          <IconX size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="vp-controls">
              <div className="vp-search">
                <IconSearch size={16} className="vp-search-icon" />
                <input
                  type="text"
                  placeholder="Tìm từ tiếng Anh hoặc tiếng Việt..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button className="vp-search-clear" onClick={() => setSearch('')} aria-label="Xoá tìm kiếm"><IconX size={14} /></button>
                )}
              </div>
              <div className="vp-tabs">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    className={`vp-tab${activeCategory === cat.id ? ' active' : ''}`}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    {cat.label}
                    {cat.count ? <span className="vp-tab-count">{cat.count}</span> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="vp-results-info">
              Hiển thị <strong>{paginated.length}</strong> / <strong>{filtered.length}</strong> từ
              {queueFull.length > 0 && <span> · {queueFull.length} từ trong hàng ôn</span>}
            </div>

            {filtered.length === 0 ? (
              <div className="vp-empty">
                <p>Không tìm thấy từ nào.</p>
                <button className="vp-btn vp-btn--ghost" onClick={() => { setSearch(''); setActiveCategory('all') }}>Xem tất cả</button>
              </div>
            ) : (
              <>
                <div className="vp-grid">
                  {paginated.map(word => (
                    <WordCard key={word.id} word={word} onClick={setSelectedWord} inQueue={queueIds.has(word.id)} />
                  ))}
                </div>
                {hasMore && (
                  <div className="vp-load-more-wrap">
                    <button className="vp-btn vp-btn--ghost" onClick={() => setPage(p => p + 1)}>
                      Xem thêm ({filtered.length - paginated.length} từ còn lại)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {selectedWord && (
        <WordModal
          word={selectedWord}
          inQueue={queueIds.has(selectedWord.id)}
          onToggleQueue={toggleQueue}
          onClose={() => setSelectedWord(null)}
        />
      )}

      {showQuiz && (
        <QuizMode
          queueWords={queueFull}
          allWords={vocabulary}
          onClose={() => setShowQuiz(false)}
          onRecordResult={recordResult}
        />
      )}

      {showFillBlank && (
        <FillBlankPractice
          words={queueFull}
          onClose={() => setShowFillBlank(false)}
          onRecordResult={recordResult}
        />
      )}

      {toast && <div className={`vp-toast vp-toast--${toast.type}`}>{toast.msg}</div>}

      <style>{`
        :root {
          --vp-bg: ${C.bg}; --vp-ink: ${C.ink}; --vp-sub: ${C.sub};
          --vp-accent: ${C.accent}; --vp-accentDark: ${C.accentDark};
          --vp-badgeBg: ${C.badgeBg}; --vp-badgeText: ${C.badgeText};
          --vp-border: ${C.border}; --vp-dark: ${C.dark};
        }
        @keyframes vp-spin { to { transform: rotate(360deg); } }

        .vp-scroll { height: 100%; overflow-y: auto; background: var(--vp-bg); }
        .vp-wrap { max-width: 1180px; margin: 0 auto; padding: 24px 20px 60px; font-family: 'Be Vietnam Pro', sans-serif; }

        .vp-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
        .vp-stats { display: flex; gap: 22px; }
        .vp-stat { text-align: center; }
        .vp-stat b { display: block; font-family: ${DISPLAY}; font-size: 1.4rem; font-weight: 800; color: var(--vp-ink); line-height: 1.1; }
        .vp-stat span { font-size: 0.72rem; color: var(--vp-sub); }
        .vp-actions { display: flex; gap: 10px; flex-wrap: wrap; }

        .vp-btn { display: inline-flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: 999px;
          font-weight: 700; font-size: 0.85rem; border: 1.5px solid transparent; cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s; white-space: nowrap; position: relative; }
        .vp-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .vp-btn--primary { background: var(--vp-accent); color: var(--vp-dark); box-shadow: 0 10px 22px -10px rgba(251,191,36,.55); }
        .vp-btn--primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 14px 26px -10px rgba(251,191,36,.6); }
        .vp-btn--ghost { background: #fff; color: var(--vp-ink); border-color: var(--vp-border); }
        .vp-btn--ghost:hover:not(:disabled) { border-color: var(--vp-accent); transform: translateY(-2px); }
        .vp-btn--dark { background: var(--vp-dark); color: #fff; }
        .vp-btn--sm { padding: 7px 13px; font-size: 0.76rem; }
        .vp-badge { position: absolute; top: -6px; right: -6px; background: var(--vp-accentDark); color: #fff;
          font-size: 0.62rem; font-weight: 800; border-radius: 999px; padding: 1px 6px; min-width: 16px; text-align: center; }
        .vp-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px;
          border-radius: 50%; border: none; background: transparent; color: var(--vp-sub); cursor: pointer; transition: background 0.15s; }
        .vp-icon-btn:hover { background: var(--vp-badgeBg); color: var(--vp-ink); }
        .vp-icon-btn--sm { width: 26px; height: 26px; }

        .vp-chip { display: inline-flex; align-items: center; background: var(--vp-badgeBg); color: var(--vp-badgeText);
          border-radius: 999px; font-size: 0.72rem; font-weight: 700; padding: 4px 12px; }
        .vp-chip--sm { padding: 2px 9px; font-size: 0.68rem; }
        .vp-chip--modal { margin: 6px 0 12px; }

        .vp-queue-panel { background: #fff; border: 1.5px solid var(--vp-border); border-radius: 20px; padding: 16px 20px; margin-bottom: 18px; }
        .vp-queue-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .vp-queue-panel-head h3 { margin: 0; font-size: 0.95rem; font-weight: 800; color: var(--vp-ink); }
        .vp-queue-panel-actions { display: flex; align-items: center; gap: 8px; }
        .vp-queue-empty { color: var(--vp-sub); font-size: 0.85rem; margin: 10px 0 0; }
        .vp-queue-list { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; max-height: 260px; overflow-y: auto; }
        .vp-queue-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: var(--vp-bg); border-radius: 12px; }
        .vp-qi-word { font-weight: 800; color: var(--vp-ink); min-width: 110px; }
        .vp-qi-viet { flex: 1; color: var(--vp-sub); font-size: 0.85rem; }

        .vp-controls { display: flex; flex-direction: column; gap: 14px; margin: 18px 0 10px; }
        .vp-search { position: relative; max-width: 420px; }
        .vp-search input { width: 100%; padding: 11px 38px; border-radius: 999px; border: 1.5px solid var(--vp-border);
          font-size: 0.9rem; background: #fff; box-sizing: border-box; }
        .vp-search input:focus { outline: 2px solid var(--vp-accent); outline-offset: 1px; border-color: var(--vp-accent); }
        .vp-search-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--vp-sub); pointer-events: none; }
        .vp-search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none;
          color: var(--vp-sub); cursor: pointer; padding: 5px; display: flex; }

        .vp-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
        .vp-tab { padding: 8px 15px; border-radius: 999px; border: 1.5px solid var(--vp-border); background: #fff;
          color: var(--vp-sub); font-size: 0.8rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;
          transition: all 0.15s; }
        .vp-tab:hover { border-color: var(--vp-accent); }
        .vp-tab.active { background: var(--vp-dark); border-color: var(--vp-dark); color: #fff; }
        .vp-tab-count { font-size: 0.66rem; opacity: 0.65; }

        .vp-results-info { font-size: 0.82rem; color: var(--vp-sub); margin: 6px 0 16px; }

        .vp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px; }
        .vp-card { position: relative; background: #fff; border: 1.5px solid var(--vp-border); border-radius: 18px;
          padding: 18px; cursor: pointer; text-align: left; font: inherit; transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s; }
        .vp-card:hover { transform: translateY(-4px); box-shadow: 0 18px 34px -18px rgba(30,58,95,.25); border-color: var(--vp-accent); }
        .vp-card.in-queue { border-color: var(--vp-accentDark); background: #FFFBEB; }
        .vp-card-dot { position: absolute; top: 14px; right: 14px; color: var(--vp-accentDark); }
        .vp-card-word { font-family: ${DISPLAY}; font-size: 1.1rem; font-weight: 800; color: var(--vp-ink); margin: 0 0 2px; }
        .vp-card-pos { font-size: 0.72rem; color: var(--vp-sub); font-style: italic; margin: 0 0 8px; }
        .vp-card-viet { font-size: 0.85rem; color: var(--vp-badgeText); margin: 0 0 14px; min-height: 2.5em; }
        .vp-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .vp-card-topic { font-size: 0.68rem; color: var(--vp-sub); background: var(--vp-bg); border-radius: 999px; padding: 3px 9px; }
        .vp-card-more { display: flex; align-items: center; gap: 3px; font-size: 0.74rem; font-weight: 700; color: var(--vp-accentDark); }

        .vp-load-more-wrap { display: flex; justify-content: center; margin-top: 26px; }
        .vp-empty { text-align: center; padding: 60px 0; color: var(--vp-sub); }
        .vp-empty p { margin-bottom: 14px; }

        .vp-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--vp-dark);
          color: #fff; padding: 12px 22px; border-radius: 999px; font-size: 0.85rem; font-weight: 600; z-index: 400;
          box-shadow: 0 14px 30px -10px rgba(0,0,0,.4); }
        .vp-toast--error { background: #B91C1C; }

        /* ── Modal (WordModal) ── */
        .vp-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.6); backdrop-filter: blur(2px);
          display: flex; align-items: flex-end; justify-content: center; z-index: 300; }
        .vp-modal-box { position: relative; background: #fff; width: 100%; max-width: 560px; max-height: 92vh;
          overflow-y: auto; border-radius: 24px 24px 0 0; padding: 30px 22px 28px; }
        .vp-modal-close { position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; border-radius: 50%;
          border: none; background: var(--vp-bg); color: var(--vp-sub); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .vp-modal-word-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding-right: 30px; }
        .vp-modal-word { font-family: ${DISPLAY}; font-size: 1.6rem; font-weight: 800; color: var(--vp-ink); margin: 0; }
        .vp-modal-pos { font-size: 0.82rem; color: var(--vp-sub); font-style: italic; margin: 8px 0 2px; }
        .vp-modal-viet { font-size: 1rem; color: var(--vp-badgeText); margin: 2px 0; }

        .vp-ipa-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin: 8px 0 2px; }
        .vp-ipa { font-size: 1.05rem; letter-spacing: 0.02em; color: var(--vp-ink); }
        .vp-ipa .consonant { font-weight: 800; color: var(--vp-accentDark); }
        .vp-ipa .vowel { color: var(--vp-ink); }
        .vp-ipa .mark { color: var(--vp-sub); font-size: 0.85em; }
        .vp-ipa-legend { display: flex; gap: 12px; font-size: 0.7rem; color: var(--vp-sub); }
        .vp-legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px; }
        .vp-legend-dot--gold { background: var(--vp-accentDark); }
        .vp-legend-dot--navy { background: var(--vp-dark); }

        .vp-pdf-example { margin: 16px 0; padding: 12px 14px; background: var(--vp-bg); border-radius: 14px;
          font-size: 0.86rem; color: var(--vp-ink); display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
        .vp-pdf-ex-label { font-size: 0.68rem; font-weight: 800; color: var(--vp-sub); text-transform: uppercase; letter-spacing: 0.03em; flex-basis: 100%; }
        .vp-hl { color: var(--vp-accentDark); background: none; }

        .vp-examples { margin-top: 20px; }
        .vp-examples-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
        .vp-examples-head h3 { display: flex; align-items: center; gap: 7px; font-size: 0.92rem; font-weight: 800; color: var(--vp-ink); margin: 0; }
        .vp-loading-area { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px 0; color: var(--vp-sub); font-size: 0.85rem; }
        .vp-error-box { text-align: center; padding: 16px 0; color: var(--vp-sub); font-size: 0.85rem; }
        .vp-examples-list { display: flex; flex-direction: column; gap: 12px; }
        .vp-example-item { border-left: 3px solid var(--vp-accent); background: var(--vp-bg); border-radius: 0 14px 14px 0; padding: 10px 14px; }
        .vp-example-en { display: flex; align-items: flex-start; gap: 8px; }
        .vp-ex-num { flex: none; width: 18px; height: 18px; border-radius: 50%; background: var(--vp-accentDark); color: #fff;
          font-size: 0.68rem; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-top: 2px; }
        .vp-example-en p { margin: 0; flex: 1; font-size: 0.88rem; color: var(--vp-ink); }
        .vp-example-viet { margin: 6px 0 0 26px; font-size: 0.82rem; color: var(--vp-badgeText); }
        .vp-viet-spoiler { margin: 6px 0 0 26px; display: flex; align-items: center; gap: 5px; background: none; border: none;
          color: var(--vp-sub); font-size: 0.78rem; cursor: pointer; }

        /* ── Practice overlays (Quiz / Fill-blank) ── */
        .vp-practice-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.65); backdrop-filter: blur(2px);
          display: flex; align-items: center; justify-content: center; z-index: 300; padding: 16px; }
        .vp-practice-box { background: #fff; width: 100%; max-width: 520px; max-height: 92vh; overflow-y: auto;
          border-radius: 24px; padding: 22px 22px 26px; }
        .vp-result-box { text-align: center; padding-top: 30px; }
        .vp-result-box h2 { font-family: ${DISPLAY}; font-size: 1.3rem; margin: 12px 0 6px; color: var(--vp-ink); }
        .vp-result-score { display: flex; align-items: baseline; justify-content: center; gap: 4px; font-family: ${DISPLAY}; }
        .vp-result-score span:first-child { font-size: 2.6rem; font-weight: 800; color: var(--vp-accentDark); }
        .vp-result-score em { font-size: 1.4rem; color: var(--vp-sub); font-style: normal; }
        .vp-result-total { font-size: 1.4rem; color: var(--vp-sub); }
        .vp-result-pct { font-size: 1.5rem; font-weight: 800; color: var(--vp-ink); margin: 6px 0; font-family: ${DISPLAY}; }
        .vp-result-msg { color: var(--vp-sub); font-size: 0.88rem; margin-bottom: 18px; }
        .vp-result-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
        .vp-fb-stats { display: flex; justify-content: center; gap: 22px; margin: 14px 0; }
        .vp-fb-stat { text-align: center; font-size: 0.72rem; color: var(--vp-sub); font-weight: 700; }
        .vp-fb-stat span { display: block; font-family: ${DISPLAY}; font-size: 1.5rem; font-weight: 800; color: var(--vp-ink); }
        .vp-fb-stat.ok span { color: #15803D; }
        .vp-fb-stat.no span { color: #B91C1C; }

        .vp-practice-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
        .vp-practice-head-right { display: flex; align-items: center; gap: 10px; }
        .vp-practice-title { display: flex; align-items: center; gap: 7px; font-weight: 800; color: var(--vp-ink); font-size: 0.95rem; }
        .vp-streak { display: flex; align-items: center; gap: 4px; font-size: 0.76rem; font-weight: 800; color: var(--vp-accentDark); }

        .vp-progress-wrap { height: 6px; background: var(--vp-bg); border-radius: 999px; overflow: hidden; margin-bottom: 8px; }
        .vp-progress-bar { height: 100%; background: var(--vp-accent); border-radius: 999px; transition: width 0.3s ease; }
        .vp-counter { display: flex; align-items: center; gap: 10px; font-size: 0.76rem; color: var(--vp-sub); margin-bottom: 16px; }
        .vp-ok { color: #15803D; font-weight: 700; }
        .vp-no { color: #B91C1C; font-weight: 700; }

        .vp-question-area { margin-bottom: 6px; }
        .vp-q-label { font-size: 0.82rem; color: var(--vp-sub); margin: 0 0 8px; }
        .vp-q-word { font-family: ${DISPLAY}; font-size: 1.6rem; font-weight: 800; color: var(--vp-ink); margin-bottom: 4px; }
        .vp-q-viet { font-size: 1.15rem; }
        .vp-q-pos { font-size: 0.78rem; color: var(--vp-sub); font-style: italic; margin: 0 0 16px; }
        .vp-q-hint { font-size: 0.82rem; color: var(--vp-badgeText); margin: 10px 0; }
        .vp-q-loading { display: flex; align-items: center; gap: 6px; color: var(--vp-sub); font-size: 0.85rem; }

        .vp-mc-options { display: flex; flex-direction: column; gap: 9px; }
        .vp-mc-option { text-align: left; padding: 12px 16px; border-radius: 14px; border: 1.5px solid var(--vp-border);
          background: #fff; font-size: 0.9rem; color: var(--vp-ink); cursor: pointer; transition: all 0.15s; }
        .vp-mc-option:hover:not(:disabled) { border-color: var(--vp-accent); }
        .vp-mc-option.selected { border-color: var(--vp-dark); background: var(--vp-bg); }
        .vp-mc-option.correct { border-color: #15803D; background: #F0FDF4; color: #15803D; font-weight: 700; }
        .vp-mc-option.wrong { border-color: #B91C1C; background: #FEF2F2; color: #B91C1C; font-weight: 700; }
        .vp-mc-option:disabled { cursor: default; }

        .vp-fill-sentence, .vp-fill-sentence-box .vp-fill-sentence { font-size: 1.05rem; color: var(--vp-ink); line-height: 1.6; }
        .vp-fill-sentence-box { background: var(--vp-bg); border-radius: 14px; padding: 16px; margin-bottom: 10px; }
        .vp-fill-revealed { }
        .vp-fill-form { display: flex; gap: 8px; margin-top: 12px; }
        .vp-fill-input { flex: 1; padding: 11px 14px; border-radius: 999px; border: 1.5px solid var(--vp-border); font-size: 0.9rem; }
        .vp-fill-input:focus { outline: 2px solid var(--vp-accent); outline-offset: 1px; border-color: var(--vp-accent); }
        .vp-fill-result { margin-top: 12px; padding: 12px 16px; border-radius: 14px; font-size: 0.88rem; }
        .vp-fill-result.correct { background: #F0FDF4; color: #15803D; }
        .vp-fill-result.wrong { background: #FEF2F2; color: #B91C1C; }
        .vp-fill-original { margin: 6px 0 0; color: var(--vp-sub); font-size: 0.82rem; }

        .vp-revealed { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--vp-border); display: flex;
          align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .vp-revealed-answer { font-size: 0.88rem; color: var(--vp-ink); }

        .vp-fb-word-info { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
          background: var(--vp-bg); border-radius: 14px; padding: 12px 16px; margin-bottom: 14px; }
        .vp-mask-wrap { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
        .vp-mask-letter { font-family: ${DISPLAY}; font-size: 1.1rem; font-weight: 800; color: var(--vp-ink); }
        .vp-letter-count { font-size: 0.7rem; color: var(--vp-sub); margin-left: 6px; }
        .vp-fb-word-meta { display: flex; align-items: center; gap: 8px; font-size: 0.76rem; color: var(--vp-sub); }
        .vp-hint-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
        .vp-viet-hint { font-size: 0.86rem; color: var(--vp-badgeText); }
        .vp-hint-btn { display: flex; align-items: center; gap: 5px; background: none; border: none; color: var(--vp-accentDark);
          font-size: 0.8rem; font-weight: 700; cursor: pointer; }
        .vp-hint-btn:disabled { color: var(--vp-sub); cursor: default; }

        .vp-practice-foot { display: flex; justify-content: flex-end; margin-top: 16px; }

        @media (min-width: 600px) {
          .vp-modal-overlay { align-items: center; padding: 20px; }
          .vp-modal-box { border-radius: 24px; }
          .vp-controls { flex-direction: row; align-items: center; justify-content: space-between; }
        }
        @media (max-width: 480px) {
          .vp-actions .vp-btn span, .vp-btn { font-size: 0.78rem; padding: 9px 13px; }
        }
      `}</style>
    </div>
  )
}
