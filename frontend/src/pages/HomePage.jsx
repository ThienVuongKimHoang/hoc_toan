import React, { useEffect, useState } from 'react'
import { fetchPublicExams } from '../store/examStore.js'
import MathText from '../components/MathText.jsx'

const FEATURES = [
  {
    icon: '📄',
    title: 'Upload đề PDF',
    desc: 'Tải lên file PDF đề thi THPT, AI tự động nhận diện toàn bộ câu hỏi trong vài giây.',
    color: '#2563eb',
  },
  {
    icon: '🤖',
    title: 'Trích xuất bằng AI',
    desc: 'Phân tích thông minh phân loại 3 dạng: Trắc nghiệm, Đúng/Sai và Trả lời ngắn.',
    color: '#7c3aed',
  },
  {
    icon: '✏️',
    title: 'Làm bài trực tuyến',
    desc: 'Làm bài ngay trên trình duyệt, chọn đáp án và kiểm tra kết quả tức thì.',
    color: '#059669',
  },
  {
    icon: '📊',
    title: 'Kiểm tra & phân tích',
    desc: 'Xem điểm từng phần, biết câu nào đúng/sai, ôn tập đúng trọng tâm hơn.',
    color: '#f97316',
  },
]

const ACCENT = ['#2563eb', '#7c3aed', '#059669', '#dc2626', '#d97706', '#0891b2']
const HUE    = [220, 250, 160, 0, 35, 195]

function fmtCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K'
  return String(n)
}

function DocPage({ exam, accent }) {
  const preview = exam.questionsPreview || []
  return (
    <div className="dp-page">
      {/* colored left border + header */}
      <div className="dp-hd" style={{ borderLeftColor: accent }}>
        <span className="dp-badge" style={{ background: accent + '18', color: accent }}>ĐỀ THI</span>
        {exam.source && <span className="dp-source">{exam.source}</span>}
      </div>
      <div className="dp-divider" style={{ background: accent }} />
      <div className="dp-qs">
        {preview.length === 0 ? (
          <span className="dp-empty">Chưa có nội dung xem trước</span>
        ) : preview.map((q, i) => (
          <div key={i} className="dp-q">
            <span className="dp-qn" style={{ color: accent }}>Câu {q.num}.</span>
            <MathText text={q.text} className="dp-qt" />
          </div>
        ))}
      </div>
      <div className="dp-fade" />
    </div>
  )
}

function FeaturedExamCard({ exam, index, onGoExam }) {
  const accent = ACCENT[index % ACCENT.length]
  const dur    = exam.settings?.duration

  return (
    <div className="exam-card hc-exam-card" onClick={() => onGoExam(exam.id)} style={{ cursor: 'pointer' }}>
      <DocPage exam={exam} accent={accent} />
      <div className="exam-body">
        <div className="hc-ec-top">
          <h3>{exam.title}</h3>
          {exam.submissionCount > 0 && (
            <span className="hc-ec-views">👁 {fmtCount(exam.submissionCount)}</span>
          )}
        </div>
        <div className="exam-meta">
          <span>📋 {exam.totalQuestions} câu</span>
          {dur && <span>⏱ {dur} phút</span>}
        </div>
        <button
          className="btn-exam"
          style={{ '--ac': accent }}
          onClick={e => { e.stopPropagation(); onGoExam(exam.id) }}
        >
          Vào thi ngay →
        </button>
      </div>
    </div>
  )
}

const STEPS = [
  { num: '1', title: 'Đăng nhập',          desc: 'Tạo tài khoản miễn phí hoặc đăng nhập chỉ trong vài giây.' },
  { num: '2', title: 'Nhập mã đề',         desc: 'Giáo viên chia sẻ link hoặc mã đề — bạn nhập vào là vào ngay.' },
  { num: '3', title: 'Làm bài & kết quả',  desc: 'Trả lời câu hỏi, nộp bài, xem điểm khi giáo viên công bố.' },
]

export default function HomePage({ onGoLobby, onGoExam, onCreateExamCTA, user }) {
  const isGuest = user?.role === 'khach'
  const [featuredExams, setFeaturedExams] = useState([])
  const [loadingExams,  setLoadingExams]  = useState(true)

  useEffect(() => {
    fetchPublicExams()
      .then(exams => setFeaturedExams(exams.slice(0, 6)))
      .catch(() => setFeaturedExams([]))
      .finally(() => setLoadingExams(false))
  }, [])

  return (
    <div className="home-page">
      {/* ── Hero ── */}
      <section className="hero-section">
        <div className="hero-wrap">
          <div className="hero-content">
            <div className="hero-badge">✨ Miễn phí 100%</div>
            <h1 className="hero-title">
              Nền tảng tự luyện Toán<br />
              <span className="hero-highlight">Thi THPT Online</span>
            </h1>
            <p className="hero-desc">
              Giáo viên tạo đề — Học sinh làm bài ngay trên trình duyệt.
              Hỗ trợ đầy đủ 3 dạng: Trắc nghiệm, Đúng/Sai, Trả lời ngắn.
            </p>
            <div className="hero-actions">
              <button className="btn-hero-primary" onClick={onGoLobby}>
                🚀 Làm bài ngay
              </button>
              <button
                className="btn-hero-secondary"
                onClick={onCreateExamCTA}
                disabled={isGuest}
              >
                {isGuest ? '🔒' : '✏️'} Tạo đề thi
              </button>
            </div>
            {isGuest && (
              <p style={{ margin: '-28px 0 32px', fontSize: '0.75rem', color: '#94a3b8' }}>
                🔒 Tạo đề thi chỉ dành cho thành viên đăng ký
              </p>
            )}
            <div className="hero-stats">
              <div className="hs-item"><strong>50+</strong><span>Đề thi mẫu</span></div>
              <div className="hs-sep" />
              <div className="hs-item"><strong>3</strong><span>Dạng câu hỏi</span></div>
              <div className="hs-sep" />
              <div className="hs-item"><strong>100%</strong><span>Miễn phí</span></div>
            </div>
          </div>

          {/* Mock UI card */}
          <div className="hero-mockup" aria-hidden>
            <div className="mockup-card">
              <div className="mockup-titlebar">
                <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
                <span className="mockup-url">hoctoan.ai — Câu 1 / 50</span>
              </div>
              <div className="mockup-body">
                <div className="mockup-q-label">Câu 1 &nbsp;<span className="pts">0.25đ</span></div>
                <div className="mockup-q-text">
                  Giá trị của <em>sin²α + cos²α</em> bằng bao nhiêu?
                </div>
                <div className="mockup-choices">
                  <div className="mc mc-correct">A.&nbsp; 1 &nbsp;✓</div>
                  <div className="mc">B.&nbsp; 0</div>
                  <div className="mc">C.&nbsp; −1</div>
                  <div className="mc">D.&nbsp; 2</div>
                </div>
                <div className="mockup-progress">
                  <div className="mp-bar"><div className="mp-fill" style={{ width: '24%' }} /></div>
                  <span>12 / 50 câu</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="features-section" id="features">
        <div className="container">
          <div className="section-hd">
            <h2>Hệ thống luyện thi có gì?</h2>
            <p>Đầy đủ công cụ giúp bạn ôn luyện hiệu quả và tiết kiệm thời gian</p>
          </div>
          <div className="features-grid">
            {FEATURES.map((f, i) => (
              <div className="feature-card" key={i}>
                <div className="feature-icon" style={{ background: f.color + '18', color: f.color }}>
                  {f.icon}
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="how-section" id="how-it-works">
        <div className="container">
          <div className="section-hd">
            <h2>Cách sử dụng</h2>
            <p>Chỉ 3 bước đơn giản để bắt đầu làm bài ngay hôm nay</p>
          </div>
          <div className="steps-row">
            {STEPS.map((s, i) => (
              <React.Fragment key={i}>
                <div className="step-card">
                  <div className="step-num">{s.num}</div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
                {i < STEPS.length - 1 && <div className="step-arrow">→</div>}
              </React.Fragment>
            ))}
          </div>
          <div className="how-cta">
            <button
              className="btn-primary btn-lg"
              onClick={onCreateExamCTA}
              disabled={isGuest}
            >
              {isGuest ? '🔒 Tạo đề thi' : 'Thử ngay miễn phí →'}
            </button>
            {isGuest && (
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
                Chỉ dành cho thành viên đăng ký
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Featured Exams ── */}
      <section className="exams-section" id="exams">
        <div className="container">
          <div className="section-hd">
            <h2>Đề thi nổi bật</h2>
            <p>Các đề thi được luyện tập nhiều nhất — cập nhật tự động</p>
          </div>

          {loadingExams ? (
            <div className="hc-exams-loading">
              <span className="hc-spin" /> Đang tải…
            </div>
          ) : featuredExams.length === 0 ? (
            <div className="hc-exams-empty">
              <div className="hce-icon">📭</div>
              <p>Chưa có đề thi công khai nào.<br />Giáo viên hãy chia sẻ đề thi!</p>
              <button
                className="btn-primary"
                onClick={onCreateExamCTA}
                disabled={isGuest}
              >
                {isGuest ? '🔒 Tạo đề thi' : 'Tạo đề thi ngay'}
              </button>
              {isGuest && (
                <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                  Chỉ dành cho thành viên đăng ký
                </p>
              )}
            </div>
          ) : (
            <div className="exams-grid">
              {featuredExams.map((exam, i) => (
                <FeaturedExamCard
                  key={exam.id}
                  exam={exam}
                  index={i}
                  onGoExam={onGoExam}
                />
              ))}
            </div>
          )}

          {!loadingExams && featuredExams.length > 0 && (
            <div className="hc-exams-more">
              <button className="btn-outline" onClick={onGoLobby}>
                Xem tất cả đề thi →
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="cta-banner">
        <div className="container">
          <h2>Bắt đầu luyện tập ngay hôm nay!</h2>
          <p>Miễn phí hoàn toàn — Đăng ký tài khoản chỉ mất 30 giây</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn-cta" onClick={onGoLobby}>
              🚀 Làm bài ngay
            </button>
            <button
              className="btn-cta btn-cta--secondary"
              onClick={onCreateExamCTA}
              disabled={isGuest}
            >
              {isGuest ? '🔒' : '✏️'} Tạo đề thi
            </button>
          </div>
          {isGuest && (
            <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#cbd5e1', textAlign: 'center' }}>
              Tạo đề thi chỉ dành cho thành viên đăng ký
            </p>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <div className="footer-logo">📐 <strong>HocToan.AI</strong></div>
            <p>Nền tảng luyện thi Toán THPT miễn phí, hỗ trợ AI trích xuất đề thi thông minh.</p>
          </div>
          <div className="footer-links">
            <h4>Tính năng</h4>
            <a href="#features">Upload đề PDF</a>
            <a href="#features">Làm bài trực tuyến</a>
            <a href="#features">Kiểm tra kết quả</a>
          </div>
          <div className="footer-links">
            <h4>Hướng dẫn</h4>
            <a href="#how-it-works">Cách dùng</a>
            <a href="#exams">Đề thi mẫu</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 HocToan.AI — Miễn phí & Mã nguồn mở</p>
        </div>
      </footer>
    </div>
  )
}
