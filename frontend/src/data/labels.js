export const DIFFICULTY_LEVELS = [
  {
    id:     'Nhận biết',
    short:  'NB',
    color:  '#16a34a',
    bg:     '#dcfce7',
    border: '#86efac',
    desc:   'Nhớ công thức, định nghĩa, nhận diện khái niệm',
  },
  {
    id:     'Thông hiểu',
    short:  'TH',
    color:  '#0891b2',
    bg:     '#cffafe',
    border: '#67e8f9',
    desc:   'Hiểu bản chất, áp dụng trực tiếp công thức',
  },
  {
    id:     'Vận dụng',
    short:  'VD',
    color:  '#ca8a04',
    bg:     '#fef9c3',
    border: '#fde047',
    desc:   'Kết hợp nhiều kiến thức để giải',
  },
  {
    id:     'Vận dụng cao',
    short:  'VDC',
    color:  '#dc2626',
    bg:     '#fee2e2',
    border: '#fca5a5',
    desc:   'Bài toán mới, nhiều bước suy luận, cần tư duy sâu',
  },
]

export const THPT_LABEL_GROUPS = [
  {
    group: 'Hàm số và ứng dụng',
    topics: [
      'Tập xác định', 'Tính đơn điệu', 'Cực trị',
      'Giá trị lớn nhất, nhỏ nhất', 'Tiệm cận', 'Đồ thị hàm số',
      'Tương giao đồ thị', 'Bài toán thực tế về hàm số',
    ],
  },
  {
    group: 'Hàm mũ – Hàm logarit',
    topics: [
      'Hàm mũ, hàm logarit', 'Phương trình mũ', 'Phương trình logarit',
      'Bất phương trình mũ', 'Bất phương trình logarit', 'Ứng dụng tăng trưởng, lãi kép',
    ],
  },
  {
    group: 'Nguyên hàm – Tích phân',
    topics: [
      'Nguyên hàm', 'Tích phân', 'Diện tích hình phẳng',
      'Thể tích khối tròn xoay', 'Ứng dụng thực tế',
    ],
  },
  {
    group: 'Số phức',
    topics: [
      'Phép toán số phức', 'Môđun', 'Biểu diễn hình học', 'Phương trình số phức',
    ],
  },
  {
    group: 'Dãy số – Cấp số',
    topics: ['Dãy số', 'Cấp số cộng', 'Cấp số nhân', 'Tổng cấp số'],
  },
  {
    group: 'Tổ hợp – Xác suất',
    topics: [
      'Quy tắc đếm', 'Hoán vị', 'Chỉnh hợp', 'Tổ hợp',
      'Nhị thức Newton', 'Xác suất cổ điển', 'Xác suất có điều kiện',
    ],
  },
  {
    group: 'Thống kê',
    topics: [
      'Thu thập và xử lý dữ liệu', 'Bảng tần số', 'Biểu đồ',
      'Trung bình', 'Trung vị', 'Tứ phân vị', 'Độ lệch chuẩn', 'Phương sai',
    ],
  },
  {
    group: 'Vector',
    topics: [
      'Vector', 'Phép cộng, trừ', 'Tích vô hướng',
      'Góc giữa hai vector', 'Ứng dụng vector',
    ],
  },
  {
    group: 'Hình học không gian',
    topics: [
      'Quan hệ song song', 'Quan hệ vuông góc', 'Góc', 'Khoảng cách',
      'Khối đa diện', 'Hình chóp', 'Hình lăng trụ', 'Thể tích',
    ],
  },
  {
    group: 'Hình học Oxyz',
    topics: [
      'Điểm', 'Vector', 'Đường thẳng', 'Mặt phẳng',
      'Mặt cầu', 'Khoảng cách', 'Góc', 'Vị trí tương đối',
    ],
  },
  {
    group: 'Phương trình và hệ phương trình',
    topics: [
      'Phương trình bậc nhất', 'Phương trình bậc hai',
      'Hệ phương trình', 'Phương trình quy về bậc hai',
    ],
  },
  {
    group: 'Bất phương trình và bất đẳng thức',
    topics: [
      'Bất phương trình', 'Hệ bất phương trình',
      'Bất đẳng thức cơ bản', 'Ứng dụng bất đẳng thức',
    ],
  },
]

export const THCS_LABEL_GROUPS = [
  {
    group: 'Số tự nhiên',
    topics: ['Phép tính', 'Lũy thừa', 'Chia hết', 'Ước và bội', 'Số nguyên tố', 'ƯCLN, BCNN'],
  },
  {
    group: 'Số nguyên',
    topics: ['Phép tính', 'Giá trị tuyệt đối', 'So sánh', 'Ứng dụng'],
  },
  {
    group: 'Phân số và số hữu tỉ',
    topics: ['Rút gọn', 'Quy đồng', 'Các phép tính', 'So sánh', 'Tỉ số'],
  },
  {
    group: 'Số thực và căn bậc hai',
    topics: ['Số vô tỉ', 'Căn bậc hai', 'Biến đổi căn thức', 'Căn bậc ba'],
  },
  {
    group: 'Biểu thức đại số',
    topics: [
      'Đơn thức', 'Đa thức', 'Thu gọn', 'Giá trị biểu thức',
      'Hằng đẳng thức đáng nhớ', 'Phân tích đa thức thành nhân tử',
    ],
  },
  {
    group: 'Phân thức đại số',
    topics: ['Rút gọn', 'Quy đồng', 'Các phép tính', 'Biến đổi'],
  },
  {
    group: 'Phương trình',
    topics: [
      'Phương trình bậc nhất một ẩn', 'Phương trình tích',
      'Phương trình chứa ẩn ở mẫu', 'Giải bài toán bằng cách lập phương trình',
    ],
  },
  {
    group: 'Hệ phương trình',
    topics: ['Hệ phương trình bậc nhất hai ẩn', 'Phương pháp thế', 'Phương pháp cộng', 'Bài toán thực tế'],
  },
  {
    group: 'Bất phương trình',
    topics: ['Bất phương trình bậc nhất', 'Biểu diễn nghiệm', 'Giải bài toán'],
  },
  {
    group: 'Hàm số và đồ thị',
    topics: [
      'Đại lượng tỉ lệ thuận', 'Đại lượng tỉ lệ nghịch',
      'Hàm số', 'Đồ thị hàm số', 'Hàm số bậc nhất',
    ],
  },
  {
    group: 'Thống kê và xác suất',
    topics: [
      'Thu thập dữ liệu', 'Bảng thống kê', 'Biểu đồ', 'Trung bình cộng',
      'Trung vị', 'Mốt', 'Xác suất thực nghiệm', 'Xác suất đơn giản',
    ],
  },
  {
    group: 'Góc',
    topics: [
      'Góc', 'Hai góc đối đỉnh', 'Hai đường thẳng song song',
      'Góc tạo bởi cát tuyến', 'Góc trong tam giác',
    ],
  },
  {
    group: 'Tam giác',
    topics: [
      'Các trường hợp bằng nhau', 'Tam giác cân', 'Tam giác đều', 'Tam giác vuông',
      'Đường trung tuyến', 'Đường cao', 'Đường phân giác', 'Đường trung trực',
    ],
  },
  {
    group: 'Tứ giác',
    topics: ['Hình thang', 'Hình bình hành', 'Hình chữ nhật', 'Hình thoi', 'Hình vuông'],
  },
  {
    group: 'Đường tròn',
    topics: ['Dây cung', 'Tiếp tuyến', 'Góc ở tâm', 'Góc nội tiếp', 'Cung', 'Tứ giác nội tiếp'],
  },
  {
    group: 'Đồng dạng',
    topics: ['Tam giác đồng dạng', 'Định lý Thales', 'Hệ quả Thales', 'Ứng dụng'],
  },
  {
    group: 'Quan hệ trong tam giác',
    topics: ['Bất đẳng thức tam giác', 'Quan hệ cạnh – góc', 'Đường trung bình'],
  },
  {
    group: 'Hình học không gian (THCS)',
    topics: [
      'Hình hộp chữ nhật', 'Hình lập phương', 'Hình lăng trụ đứng',
      'Hình chóp', 'Hình trụ', 'Hình nón', 'Hình cầu',
    ],
  },
  {
    group: 'Diện tích và chu vi',
    topics: [
      'Tam giác', 'Hình chữ nhật', 'Hình vuông', 'Hình bình hành',
      'Hình thang', 'Hình tròn', 'Hình quạt',
    ],
  },
  {
    group: 'Quan hệ vuông góc và song song',
    topics: ['Đường thẳng vuông góc', 'Song song', 'Khoảng cách', 'Góc giữa các đường'],
  },
  {
    group: 'Bài toán thực tế',
    topics: [
      'Chuyển động', 'Năng suất', 'Công việc', 'Tỉ lệ',
      'Lãi suất', 'Hình học thực tế', 'Thống kê thực tế',
    ],
  },
]

export const THPT_TOPICS = THPT_LABEL_GROUPS.flatMap(g =>
  g.topics.map(t => ({ topic: t, group: g.group, grade: 'thpt' }))
)
export const THCS_TOPICS = THCS_LABEL_GROUPS.flatMap(g =>
  g.topics.map(t => ({ topic: t, group: g.group, grade: 'thcs' }))
)

/* ══════════════════════════════════════════════════════════════════════
   VẬT LÝ
══════════════════════════════════════════════════════════════════════ */
export const LY_THPT_LABEL_GROUPS = [
  {
    group: 'Động học',
    topics: [
      'Chuyển động thẳng', 'Chuyển động biến đổi đều', 'Chuyển động rơi tự do',
      'Chuyển động tròn đều', 'Đồ thị chuyển động',
    ],
  },
  {
    group: 'Động lực học',
    topics: [
      'Ba định luật Newton', 'Các loại lực', 'Lực ma sát', 'Lực đàn hồi',
      'Lực hấp dẫn', 'Lực hướng tâm', 'Cân bằng lực',
    ],
  },
  {
    group: 'Công – Năng lượng',
    topics: [
      'Công', 'Công suất', 'Động năng', 'Thế năng', 'Cơ năng',
      'Định luật bảo toàn năng lượng', 'Hiệu suất',
    ],
  },
  {
    group: 'Động lượng',
    topics: ['Động lượng', 'Xung lượng', 'Va chạm', 'Định luật bảo toàn động lượng'],
  },
  {
    group: 'Dao động',
    topics: [
      'Dao động điều hòa', 'Con lắc lò xo', 'Con lắc đơn', 'Pha dao động',
      'Năng lượng dao động', 'Dao động tắt dần', 'Dao động cưỡng bức', 'Cộng hưởng',
    ],
  },
  {
    group: 'Sóng cơ',
    topics: [
      'Sóng cơ', 'Bước sóng', 'Tần số', 'Giao thoa', 'Sóng dừng',
      'Sóng âm', 'Hiệu ứng Doppler',
    ],
  },
  {
    group: 'Nhiệt học',
    topics: [
      'Nội năng', 'Chất khí', 'Phương trình trạng thái',
      'Các quá trình nhiệt', 'Nguyên lý nhiệt động lực học',
    ],
  },
  {
    group: 'Điện trường',
    topics: [
      'Điện tích', 'Định luật Coulomb', 'Điện trường', 'Cường độ điện trường',
      'Điện thế', 'Hiệu điện thế', 'Tụ điện',
    ],
  },
  {
    group: 'Dòng điện một chiều',
    topics: [
      'Dòng điện', 'Định luật Ohm', 'Ghép điện trở', 'Suất điện động',
      'Công của dòng điện', 'Công suất điện',
    ],
  },
  {
    group: 'Từ trường',
    topics: ['Nam châm', 'Từ trường', 'Cảm ứng từ', 'Lực từ', 'Lực Lorentz'],
  },
  {
    group: 'Cảm ứng điện từ',
    topics: ['Từ thông', 'Định luật Faraday', 'Định luật Lenz', 'Suất điện động cảm ứng'],
  },
  {
    group: 'Dòng điện xoay chiều',
    topics: [
      'Mạch RLC', 'Cộng hưởng điện', 'Công suất AC', 'Hệ số công suất',
      'Máy biến áp', 'Truyền tải điện năng',
    ],
  },
  {
    group: 'Quang học',
    topics: [
      'Phản xạ', 'Khúc xạ', 'Thấu kính', 'Mắt', 'Dụng cụ quang',
      'Giao thoa ánh sáng', 'Nhiễu xạ', 'Tán sắc',
    ],
  },
  {
    group: 'Lượng tử ánh sáng',
    topics: ['Photon', 'Hiệu ứng quang điện', 'Quang phổ', 'Laser'],
  },
  {
    group: 'Vật lý hạt nhân',
    topics: [
      'Cấu tạo hạt nhân', 'Độ hụt khối', 'Năng lượng liên kết', 'Phóng xạ',
      'Phản ứng hạt nhân', 'Phân hạch', 'Nhiệt hạch',
    ],
  },
  {
    group: 'Thực hành và xử lý số liệu',
    topics: ['Sai số', 'Đồ thị', 'Thí nghiệm', 'Phân tích kết quả'],
  },
]

export const LY_THCS_LABEL_GROUPS = [
  {
    group: 'Đo lường',
    topics: [
      'Đơn vị đo (SI)', 'Đo chiều dài', 'Đo khối lượng', 'Đo thời gian',
      'Đo nhiệt độ', 'Sai số đo', 'Dụng cụ đo',
    ],
  },
  {
    group: 'Chuyển động',
    topics: [
      'Chuyển động và đứng yên', 'Quãng đường', 'Tốc độ', 'Vận tốc',
      'Đồ thị chuyển động (cơ bản)',
    ],
  },
  {
    group: 'Lực',
    topics: [
      'Khái niệm lực', 'Biểu diễn lực', 'Hợp lực', 'Cân bằng lực',
      'Lực ma sát', 'Lực đàn hồi', 'Trọng lực', 'Áp suất',
    ],
  },
  {
    group: 'Công và năng lượng',
    topics: [
      'Công cơ học', 'Công suất', 'Cơ năng', 'Động năng', 'Thế năng',
      'Chuyển hóa năng lượng', 'Hiệu suất',
    ],
  },
  {
    group: 'Nhiệt học',
    topics: [
      'Nhiệt năng', 'Nhiệt lượng', 'Dẫn nhiệt', 'Đối lưu', 'Bức xạ nhiệt',
      'Nở vì nhiệt', 'Sự nóng chảy', 'Sự đông đặc', 'Bay hơi', 'Ngưng tụ', 'Sôi',
    ],
  },
  {
    group: 'Âm học',
    topics: [
      'Nguồn âm', 'Độ cao của âm', 'Độ to của âm', 'Môi trường truyền âm',
      'Phản xạ âm', 'Chống ô nhiễm tiếng ồn',
    ],
  },
  {
    group: 'Quang học',
    topics: [
      'Nguồn sáng', 'Tia sáng', 'Bóng tối', 'Nhật thực, nguyệt thực',
      'Phản xạ ánh sáng', 'Gương phẳng', 'Gương cầu lồi', 'Gương cầu lõm',
      'Khúc xạ ánh sáng', 'Thấu kính hội tụ', 'Thấu kính phân kỳ', 'Mắt', 'Kính lúp',
    ],
  },
  {
    group: 'Điện học',
    topics: [
      'Điện tích', 'Dòng điện', 'Nguồn điện', 'Mạch điện', 'Cường độ dòng điện',
      'Hiệu điện thế', 'Điện trở', 'Định luật Ôm (mức cơ bản)', 'Công suất điện',
      'Điện năng', 'An toàn điện',
    ],
  },
  {
    group: 'Từ học',
    topics: ['Nam châm', 'Từ trường', 'Đường sức từ', 'Từ trường của dòng điện', 'Nam châm điện'],
  },
  {
    group: 'Điện từ học',
    topics: [
      'Cảm ứng điện từ (giới thiệu)', 'Máy phát điện', 'Động cơ điện',
      'Máy biến áp (giới thiệu)',
    ],
  },
  {
    group: 'Năng lượng và ứng dụng',
    topics: [
      'Các dạng năng lượng', 'Chuyển hóa năng lượng', 'Năng lượng tái tạo',
      'Tiết kiệm năng lượng',
    ],
  },
]

/* ══════════════════════════════════════════════════════════════════════
   HÓA HỌC
══════════════════════════════════════════════════════════════════════ */
export const HOA_THPT_LABEL_GROUPS = [
  {
    group: 'Cấu tạo nguyên tử',
    topics: ['Thành phần nguyên tử', 'Đồng vị', 'Cấu hình electron', 'Electron hóa trị', 'Số oxi hóa'],
  },
  {
    group: 'Bảng tuần hoàn các nguyên tố hóa học',
    topics: [
      'Ô nguyên tố', 'Chu kỳ', 'Nhóm', 'Quy luật biến đổi', 'Bán kính nguyên tử',
      'Độ âm điện', 'Năng lượng ion hóa',
    ],
  },
  {
    group: 'Liên kết hóa học',
    topics: [
      'Liên kết ion', 'Liên kết cộng hóa trị', 'Liên kết kim loại',
      'Liên kết hiđro', 'Lewis', 'Hình học phân tử',
    ],
  },
  {
    group: 'Phản ứng hóa học',
    topics: ['Phản ứng oxi hóa – khử', 'Cân bằng phương trình', 'Nhiệt hóa học', 'Entanpi (mức cơ bản)'],
  },
  {
    group: 'Tốc độ phản ứng và cân bằng hóa học',
    topics: ['Tốc độ phản ứng', 'Các yếu tố ảnh hưởng', 'Cân bằng hóa học', 'Nguyên lý Le Chatelier'],
  },
  {
    group: 'Dung dịch và điện li',
    topics: ['Chất điện li', 'Axit', 'Bazơ', 'Muối', 'pH', 'Thủy phân muối', 'Chuẩn độ axit – bazơ'],
  },
  {
    group: 'Điện hóa học',
    topics: ['Pin điện', 'Điện phân', 'Ăn mòn kim loại', 'Bảo vệ kim loại'],
  },
  {
    group: 'Kim loại',
    topics: [
      'Tính chất vật lí', 'Tính chất hóa học', 'Dãy hoạt động hóa học', 'Điều chế kim loại',
      'Hợp kim', 'Kim loại kiềm', 'Kim loại kiềm thổ', 'Nhôm', 'Sắt', 'Crom',
    ],
  },
  {
    group: 'Phi kim',
    topics: [
      'Halogen', 'Oxi', 'Lưu huỳnh', 'Nitơ', 'Photpho', 'Cacbon', 'Silic',
      'Một số hợp chất quan trọng',
    ],
  },
  {
    group: 'Đại cương hóa học hữu cơ',
    topics: ['Đặc điểm hợp chất hữu cơ', 'Đồng đẳng', 'Đồng phân', 'Danh pháp', 'Công thức cấu tạo'],
  },
  {
    group: 'Hiđrocacbon',
    topics: ['Ankan', 'Anken', 'Ankin', 'Aren (Benzen)'],
  },
  {
    group: 'Dẫn xuất hiđrocacbon',
    topics: [
      'Dẫn xuất halogen', 'Ancol', 'Phenol', 'Andehit', 'Xeton',
      'Axit cacboxylic', 'Este',
    ],
  },
  {
    group: 'Hợp chất chứa nitơ',
    topics: ['Amin', 'Amino axit', 'Peptit', 'Protein'],
  },
  {
    group: 'Carbohydrate',
    topics: ['Glucozơ', 'Fructozơ', 'Saccarozơ', 'Tinh bột', 'Xenlulozơ'],
  },
  {
    group: 'Polime',
    topics: ['Trùng hợp', 'Trùng ngưng', 'Chất dẻo', 'Cao su', 'Tơ'],
  },
  {
    group: 'Hóa học và đời sống',
    topics: ['Phân bón', 'Hóa học môi trường', 'Hóa học xanh', 'Vật liệu mới', 'Năng lượng'],
  },
  {
    group: 'Tính toán hóa học',
    topics: [
      'Mol', 'Hiệu suất phản ứng', 'Nồng độ dung dịch', 'Bảo toàn khối lượng',
      'Bảo toàn nguyên tố', 'Bảo toàn electron', 'Bài toán hỗn hợp',
      'Bài toán khí', 'Bài toán dung dịch',
    ],
  },
]

export const HOA_THCS_LABEL_GROUPS = [
  {
    group: 'Chất và sự biến đổi của chất',
    topics: [
      'Chất', 'Tính chất của chất', 'Chất tinh khiết', 'Hỗn hợp', 'Tách chất',
      'Hiện tượng vật lí', 'Hiện tượng hóa học',
    ],
  },
  {
    group: 'Nguyên tử và nguyên tố hóa học',
    topics: [
      'Nguyên tử', 'Cấu tạo nguyên tử', 'Nguyên tố hóa học', 'Ký hiệu hóa học',
      'Nguyên tử khối', 'Phân tử', 'Phân tử khối',
    ],
  },
  {
    group: 'Công thức hóa học',
    topics: ['Hóa trị', 'Lập công thức hóa học', 'Tính theo công thức hóa học', 'Ý nghĩa của công thức hóa học'],
  },
  {
    group: 'Phản ứng hóa học',
    topics: [
      'Phương trình hóa học', 'Cân bằng phương trình', 'Định luật bảo toàn khối lượng',
      'Các loại phản ứng hóa học',
    ],
  },
  {
    group: 'Mol và tính toán hóa học',
    topics: [
      'Mol', 'Khối lượng mol', 'Thể tích mol chất khí',
      'Chuyển đổi giữa mol – khối lượng – thể tích', 'Tính theo phương trình hóa học',
    ],
  },
  {
    group: 'Oxi – Không khí',
    topics: ['Tính chất của oxi', 'Điều chế oxi', 'Không khí', 'Ozon', 'Sự cháy', 'Sự oxi hóa'],
  },
  {
    group: 'Hiđro và nước',
    topics: [
      'Hiđro', 'Điều chế hiđro', 'Phản ứng oxi hóa – khử (mức cơ bản)',
      'Nước', 'Vai trò của nước',
    ],
  },
  {
    group: 'Dung dịch',
    topics: ['Dung môi', 'Chất tan', 'Độ tan', 'Nồng độ phần trăm', 'Nồng độ mol', 'Pha chế dung dịch'],
  },
  {
    group: 'Axit – Bazơ – Muối',
    topics: [
      'Axit', 'Bazơ', 'Muối', 'Thang pH', 'Chỉ thị màu',
      'Phản ứng trung hòa', 'Phản ứng trao đổi',
    ],
  },
  {
    group: 'Kim loại',
    topics: [
      'Tính chất vật lí', 'Tính chất hóa học', 'Dãy hoạt động hóa học',
      'Điều chế kim loại', 'Hợp kim', 'Ăn mòn kim loại',
    ],
  },
  {
    group: 'Phi kim',
    topics: ['Tính chất của phi kim', 'Clo', 'Cacbon', 'Silic', 'Một số hợp chất quan trọng'],
  },
  {
    group: 'Hóa học hữu cơ',
    topics: ['Hợp chất hữu cơ', 'Metan', 'Etilen', 'Axetilen', 'Benzen', 'Nhiên liệu'],
  },
]

/* ══════════════════════════════════════════════════════════════════════
   Tra cứu nhãn theo môn + cấp học.
   Mỗi môn có bộ nhãn THPT và THCS riêng. Môn không có nhãn (anh, văn…) → null.
══════════════════════════════════════════════════════════════════════ */
export const SUBJECT_LABEL_GROUPS = {
  toan: { thpt: THPT_LABEL_GROUPS,     thcs: THCS_LABEL_GROUPS },
  ly:   { thpt: LY_THPT_LABEL_GROUPS,  thcs: LY_THCS_LABEL_GROUPS },
  hoa:  { thpt: HOA_THPT_LABEL_GROUPS, thcs: HOA_THCS_LABEL_GROUPS },
}

/** Nhãn chủ đề cho môn + cấp học. Trả [] nếu môn chưa có bộ nhãn (Anh, Văn…). */
export function getLabelGroups(subject = 'toan', grade = 'thpt') {
  const bySubject = SUBJECT_LABEL_GROUPS[subject]
  if (!bySubject) return []
  return bySubject[grade === 'thcs' ? 'thcs' : 'thpt'] || []
}

/** Môn có bộ nhãn chủ đề để phân loại hay không (Toán/Lý/Hóa có; Anh/Văn chưa). */
export function subjectHasLabels(subject) {
  return !!SUBJECT_LABEL_GROUPS[subject]
}
