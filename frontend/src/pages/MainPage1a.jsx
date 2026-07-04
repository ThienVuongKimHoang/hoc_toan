// MainPage1a.jsx — Trang chủ Trung tâm Ánh Sáng (phương án 1a — Nắng vàng)
// Cách dùng:
//   1. Copy file này vào src/ của project React (Vite/CRA/Next đều được).
//   2. Thêm font vào index.html:
//      <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Baloo+2:wght@600;700;800&display=swap" rel="stylesheet">
//   3. Đặt ảnh lớp học vào src/assets/lop-hoc.jpg (hoặc sửa đường dẫn import bên dưới).
//   4. import MainPage from "./MainPage1a"; rồi render <MainPage />.

import classPhoto from "./assets/lop-hoc.jpg";

// ====== Thông tin trung tâm ======
const INFO = {
  name: "Trung tâm Ánh Sáng",
  phone: "098 532 22 77",
  tel: "tel:0985322277",
  fb: "https://www.facebook.com/toan.ly.hoa.thay.duc.di.an",
  address: "399/1 Trần Hưng Đạo, Đông Hòa, Dĩ An, Bình Dương",
  mapSrc:
    "https://www.google.com/maps?q=" +
    encodeURIComponent("399/1 Trần Hưng Đạo, Đông Hòa, Dĩ An, Bình Dương") +
    "&z=16&output=embed",
};

// ====== Màu sắc & font ======
const C = {
  bg: "#FFFBF0",       // nền kem
  ink: "#2B2416",      // chữ chính
  sub: "#6B5C3E",      // chữ phụ
  accent: "#F2A70C",   // vàng nắng
  accentDark: "#B8860B",
  badgeBg: "#FCEFD2",
  badgeText: "#8A6410",
  border: "#F0E4C8",
  dark: "#2B2416",
  darkSub: "#D8CCAE",
};
const DISPLAY = "'Baloo 2', sans-serif";
const BODY = "'Be Vietnam Pro', sans-serif";

// ====== Dữ liệu ======
const STATS = [
  { value: "12+", label: "năm kinh nghiệm giảng dạy" },
  { value: "95%", label: "học viên tăng từ 2 điểm trở lên" },
  { value: "8.2", label: "điểm trung bình thi vào 10 môn Toán" },
  { value: "6.5+", label: "IELTS đầu ra trung bình" },
];

const TEACHERS = [
  {
    name: "Thầy Đức",
    subject: "Toán – Lý – Hóa",
    bio: "Hơn 12 năm luyện thi vào 10 và tốt nghiệp THPT, nổi tiếng dạy dễ hiểu với học sinh mất gốc.",
    photo: null, // thay bằng import ảnh thật
  },
  {
    name: "Cô Hương",
    subject: "Ngữ Văn",
    bio: "Chuyên luyện nghị luận xã hội và văn học, chấm chữa bài từng em mỗi tuần.",
    photo: null,
  },
  {
    name: "Cô My",
    subject: "Tiếng Anh – IELTS",
    bio: "IELTS 8.0, phụ trách lớp tiếng Anh phổ thông và luyện IELTS mục tiêu 6.5+.",
    photo: null,
  },
];

const COURSES = [
  { name: "Toán 6 – 12", desc: "2–3 buổi/tuần · bám sát chương trình trên lớp, luyện đề theo từng kỳ thi.", fee: "500.000đ" },
  { name: "Lý – Hóa 8 – 12", desc: "Học chắc lý thuyết, thí nghiệm minh họa, luyện chuyên đề thi tốt nghiệp.", fee: "500.000đ" },
  { name: "Ngữ Văn 9 & 12", desc: "Luyện viết mỗi buổi, chấm chữa chi tiết, ôn trọng tâm thi vào 10 và THPT.", fee: "450.000đ" },
  { name: "Tiếng Anh phổ thông", desc: "Ngữ pháp – từ vựng – đề thi, dành cho học sinh lớp 6 – 12.", fee: "500.000đ" },
];

const IELTS_COURSE = {
  name: "IELTS 5.0 → 6.5+",
  desc: "Lộ trình 4 – 6 tháng, luyện đủ 4 kỹ năng, thi thử hàng tháng có chấm band.",
  fee: "800.000đ",
};

const TESTIMONIALS = [
  {
    quote: "Em mất gốc Toán từ lớp 7, học thầy Đức một năm thì thi vào 10 được 8.5. Thầy giảng chậm, kỹ, bài nào chưa hiểu được hỏi lại thoải mái.",
    who: "Minh Anh — học sinh lớp 9, THCS Đông Hòa",
  },
  {
    quote: "Lớp Lý – Hóa học vui mà chắc. Nhờ luyện đề ở trung tâm, em đạt 9.0 Hóa kỳ thi tốt nghiệp vừa rồi.",
    who: "Quốc Bảo — học sinh lớp 12, THPT Dĩ An",
  },
  {
    quote: "Cô My sửa từng câu Writing, mỗi tuần đều có bài Speaking 1-1. Sau 4 tháng em đạt IELTS 6.5 đúng mục tiêu.",
    who: "Thu Hà — sinh viên năm nhất",
  },
];

// ====== Component con ======
function Header() {
  const nav = [
    ["#gioithieu", "Giới thiệu"],
    ["#giaovien", "Giáo viên"],
    ["#khoahoc", "Khóa học"],
    ["#lienhe", "Liên hệ"],
  ];
  return (
    <header style={{ display: "flex", alignItems: "center", gap: 28, padding: "18px 48px", background: C.bg, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.accent, display: "grid", placeItems: "center", color: C.bg, font: `800 15px ${DISPLAY}` }}>ÁS</div>
        <div style={{ font: `800 20px ${DISPLAY}` }}>{INFO.name}</div>
      </div>
      <nav style={{ display: "flex", gap: 26, marginLeft: "auto", fontSize: 14.5, fontWeight: 600, color: C.sub }}>
        {nav.map(([href, label]) => (
          <a key={href} href={href} style={{ color: "inherit", textDecoration: "none" }}>{label}</a>
        ))}
      </nav>
      <a href={INFO.tel} style={{ background: C.accent, color: "#fff", fontWeight: 700, fontSize: 14.5, padding: "11px 20px", borderRadius: 999, textDecoration: "none" }}>{INFO.phone}</a>
    </header>
  );
}

function Hero() {
  const dot = { width: 8, height: 8, borderRadius: "50%", background: C.accent, flex: "none", transform: "translateY(-1px)" };
  return (
    <div id="gioithieu" style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 52, padding: "64px 48px 56px", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["Toán · Lý · Hóa · Ngữ Văn", "Tiếng Anh · IELTS"].map((t) => (
            <span key={t} style={{ background: C.badgeBg, color: C.badgeText, fontSize: 13, fontWeight: 700, padding: "6px 13px", borderRadius: 999 }}>{t}</span>
          ))}
        </div>
        <h1 style={{ margin: 0, font: `800 52px/1.12 ${DISPLAY}`, textWrap: "pretty" }}>Học chắc kiến thức, sáng con đường thi cử</h1>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.65, color: C.sub, maxWidth: "52ch", textWrap: "pretty" }}>
          Trung tâm Ánh Sáng tại Dĩ An đồng hành cùng học sinh từ lớp 6 đến lớp 12: lớp nhỏ, thầy cô theo sát từng em, học phí phù hợp với phụ huynh.
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href="#lienhe" style={{ background: C.ink, color: C.bg, fontWeight: 700, fontSize: 15.5, padding: "14px 26px", borderRadius: 999, textDecoration: "none" }}>Đăng ký học thử miễn phí</a>
          <a href={INFO.fb} target="_blank" rel="noopener noreferrer" style={{ color: C.badgeText, fontWeight: 700, fontSize: 15, textDecoration: "none", borderBottom: `2px solid ${C.accent}`, paddingBottom: 2 }}>Fanpage của trung tâm</a>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 8, fontSize: 14.5, color: C.sub }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}><span style={dot} />{INFO.address}</div>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}><span style={dot} />Mở lớp cả tuần, sáng – chiều – tối</div>
        </div>
      </div>
      <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
        <img
          src={classPhoto}
          alt="Lớp học tại Trung tâm Ánh Sáng"
          style={{ width: "100%", maxWidth: 480, aspectRatio: "4/4.6", objectFit: "cover", borderRadius: 28, transform: "rotate(2deg)", boxShadow: "0 24px 48px -20px rgba(122,88,10,.4)" }}
        />
        <div style={{ position: "absolute", left: -8, bottom: 26, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 18, padding: "14px 20px", boxShadow: "0 12px 28px -14px rgba(122,88,10,.35)", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ font: `800 26px ${DISPLAY}`, color: C.accent }}>1.500+</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>học viên đã theo học</div>
        </div>
      </div>
    </div>
  );
}

function Stats() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, padding: "0 48px 56px" }}>
      {STATS.map((s) => (
        <div key={s.label} style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 20, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ font: `800 30px ${DISPLAY}`, color: C.accent }}>{s.value}</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: C.sub }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function Teachers() {
  return (
    <div id="giaovien" style={{ padding: "56px 48px", background: "#fff", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
      <h2 style={{ margin: "0 0 8px", font: `800 34px ${DISPLAY}` }}>Đội ngũ giáo viên</h2>
      <p style={{ margin: "0 0 28px", color: C.sub, fontSize: 15.5 }}>Thầy cô trực tiếp đứng lớp, không qua trợ giảng.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
        {TEACHERS.map((t) => (
          <div key={t.name} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 22, padding: 26, display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
            {t.photo ? (
              <img src={t.photo} alt={t.name} style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: 96, height: 96, borderRadius: "50%", background: C.badgeBg, display: "grid", placeItems: "center", font: `800 24px ${DISPLAY}`, color: C.badgeText }}>
                {t.name.split(" ").pop().charAt(0)}
              </div>
            )}
            <div>
              <div style={{ font: `800 20px ${DISPLAY}` }}>{t.name}</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.accentDark, marginTop: 2 }}>{t.subject}</div>
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: C.sub }}>{t.bio}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Courses() {
  const card = { background: "#fff", border: `1px solid ${C.border}`, borderRadius: 22, padding: 26, display: "flex", flexDirection: "column", gap: 10 };
  const fee = { marginTop: "auto", font: `800 24px ${DISPLAY}`, color: C.accent };
  const per = { font: `600 13px ${BODY}`, color: C.sub };
  return (
    <div id="khoahoc" style={{ padding: "56px 48px" }}>
      <h2 style={{ margin: "0 0 8px", font: `800 34px ${DISPLAY}` }}>Khóa học &amp; học phí</h2>
      <p style={{ margin: "0 0 28px", color: C.sub, fontSize: 15.5 }}>Học phí tham khảo, đã gồm tài liệu. Lớp tối đa 20 em.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
        {COURSES.map((c) => (
          <div key={c.name} style={card}>
            <div style={{ font: `800 19px ${DISPLAY}` }}>{c.name}</div>
            <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6 }}>{c.desc}</div>
            <div style={fee}>{c.fee}<span style={per}> /tháng</span></div>
          </div>
        ))}
        {/* Khóa IELTS nổi bật */}
        <div style={{ ...card, background: C.dark, color: C.bg, border: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ font: `800 19px ${DISPLAY}` }}>{IELTS_COURSE.name}</div>
            <span style={{ background: C.accent, color: C.dark, fontSize: 11, fontWeight: 800, padding: "4px 9px", borderRadius: 999 }}>NỔI BẬT</span>
          </div>
          <div style={{ fontSize: 14, color: C.darkSub, lineHeight: 1.6 }}>{IELTS_COURSE.desc}</div>
          <div style={fee}>{IELTS_COURSE.fee}<span style={{ ...per, color: C.darkSub }}> /tháng</span></div>
        </div>
        {/* Ô tư vấn */}
        <div style={{ border: "2px dashed #E4D4A8", borderRadius: 22, padding: 26, display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
          <div style={{ font: `800 19px ${DISPLAY}`, color: C.badgeText }}>Chưa biết chọn lớp nào?</div>
          <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.6 }}>
            Gọi <a href={INFO.tel} style={{ color: C.accentDark, fontWeight: 700, textDecoration: "none" }}>{INFO.phone}</a> để được kiểm tra đầu vào và tư vấn miễn phí.
          </div>
        </div>
      </div>
    </div>
  );
}

function Testimonials() {
  return (
    <div style={{ padding: "56px 48px", background: C.badgeBg }}>
      <h2 style={{ margin: "0 0 28px", font: `800 34px ${DISPLAY}` }}>Học viên nói gì?</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
        {TESTIMONIALS.map((t) => (
          <figure key={t.who} style={{ margin: 0, background: "#fff", borderRadius: 22, padding: 26, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ font: `800 28px ${DISPLAY}`, color: C.accent, lineHeight: 1 }}>“</div>
            <blockquote style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: C.ink }}>{t.quote}</blockquote>
            <figcaption style={{ fontSize: 13.5, fontWeight: 700, color: C.badgeText }}>{t.who}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function Contact() {
  const input = { background: "#3A3220", border: "1px solid #55492E", borderRadius: 14, padding: "14px 16px", fontSize: 14.5, color: C.bg, fontFamily: "inherit" };
  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: gửi dữ liệu form về server / Google Sheets / Zalo OA...
    alert("Đã nhận đăng ký! Trung tâm sẽ liên hệ trong 24 giờ.");
  };
  return (
    <div id="lienhe" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, padding: "56px 48px", alignItems: "stretch" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 style={{ margin: 0, font: `800 34px ${DISPLAY}` }}>Ghé thăm trung tâm</h2>
        <div style={{ fontSize: 15, lineHeight: 1.7, color: C.sub }}>
          {INFO.address}
          <br />
          Hotline: <a href={INFO.tel} style={{ color: C.accentDark, fontWeight: 700, textDecoration: "none" }}>{INFO.phone}</a>
          {" · "}
          <a href={INFO.fb} target="_blank" rel="noopener noreferrer" style={{ color: C.accentDark, fontWeight: 700, textDecoration: "none" }}>Facebook trung tâm</a>
        </div>
        <iframe src={INFO.mapSrc} title="Bản đồ Trung tâm Ánh Sáng" loading="lazy" style={{ border: 0, width: "100%", flex: 1, minHeight: 280, borderRadius: 20 }} />
      </div>
      <form onSubmit={handleSubmit} style={{ background: C.dark, borderRadius: 26, padding: 36, display: "flex", flexDirection: "column", gap: 16, color: C.bg }}>
        <h3 style={{ margin: 0, font: `800 26px ${DISPLAY}` }}>Đăng ký tư vấn</h3>
        <p style={{ margin: 0, fontSize: 14, color: C.darkSub, lineHeight: 1.6 }}>Để lại thông tin, trung tâm sẽ gọi lại trong 24 giờ.</p>
        <input type="text" name="name" required placeholder="Họ tên phụ huynh / học sinh" style={input} />
        <input type="tel" name="phone" required placeholder="Số điện thoại" style={input} />
        <select name="subject" style={input}>
          <option>Quan tâm môn: Toán</option>
          <option>Lý – Hóa</option>
          <option>Ngữ Văn</option>
          <option>Tiếng Anh phổ thông</option>
          <option>IELTS</option>
        </select>
        <button type="submit" style={{ background: C.accent, color: C.dark, border: 0, borderRadius: 999, padding: 15, font: `800 15.5px ${BODY}`, cursor: "pointer" }}>
          Gửi đăng ký
        </button>
      </form>
    </div>
  );
}

function Footer() {
  return (
    <footer style={{ display: "flex", alignItems: "center", gap: 16, padding: "22px 48px", borderTop: `1px solid ${C.border}`, fontSize: 13, color: "#8A7A54" }}>
      <div style={{ font: `800 15px ${DISPLAY}`, color: C.ink }}>{INFO.name}</div>
      <div style={{ marginLeft: "auto" }}>{INFO.address} · {INFO.phone}</div>
    </footer>
  );
}

// ====== Trang chính ======
export default function MainPage() {
  return (
    <div style={{ background: C.bg, color: C.ink, fontFamily: BODY, minHeight: "100vh" }}>
      <Header />
      <Hero />
      <Stats />
      <Teachers />
      <Courses />
      <Testimonials />
      <Contact />
      <Footer />
    </div>
  );
}
