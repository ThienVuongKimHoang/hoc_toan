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
