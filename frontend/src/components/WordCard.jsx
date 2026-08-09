import { IconBookmarkFilled, IconChevronRight } from './VocabIcons.jsx'
import { categoryLabel } from '../utils/vocabCategories.js'

export default function WordCard({ word, onClick, inQueue }) {
  return (
    <button type="button" className={`vp-card${inQueue ? ' in-queue' : ''}`} onClick={() => onClick(word)}>
      {inQueue && <span className="vp-card-dot" title="Đang trong hàng ôn tập"><IconBookmarkFilled size={12} /></span>}
      <h3 className="vp-card-word">{word.word}</h3>
      <p className="vp-card-pos">{word.pos}</p>
      <p className="vp-card-viet">{word.vietnamese}</p>
      <div className="vp-card-foot">
        <span className="vp-card-topic">{categoryLabel(word.category)}</span>
        <span className="vp-card-more">Chi tiết <IconChevronRight size={14} sw={2.2} /></span>
      </div>
    </button>
  )
}
