import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Cấu hình dotenv để đọc file .env
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = 3000;

// Hỗ trợ parse JSON và tệp đính kèm lớn (cho phép nộp file giả lập)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Khởi tạo Gemini API Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// ==========================================
// CƠ SỞ DỮ LIỆU GIẢ LẬP (Mô phỏng Google Sheets)
// ==========================================

interface User {
  id: string; // Mã SV/GV
  name: string; // Họ Tên
  role: "Admin" | "Teacher" | "Student"; // Vai trò
  className: string; // Mã Lớp
  password?: string; // Mật khẩu đăng nhập
}

interface AttendanceSession {
  id: string; // Mã Phiên
  className: string; // Mã Lớp
  code: string; // Mã Điểm Danh (6 ký tự)
  startTime: string; // Thời gian bắt đầu
  durationMinutes: number; // Số phút hiệu lực
  date: string; // Ngày (YYYY-MM-DD)
  isActive: boolean;
}

interface AttendanceLog {
  id: string; // Mã Log
  sessionId: string; // Mã Phiên
  studentId: string; // Mã Sinh Viên
  time: string; // Thời gian bấm
  status: "Hợp lệ" | "Muộn"; // Trạng thái (đã bỏ GPS)
  ip: string; // IP
}

interface Assignment {
  id: string; // Mã Bài Tập
  title: string; // Tiêu đề
  content: string; // Nội dung
  dueDate: string; // Hạn nộp
}

interface Submission {
  id: string; // Mã Nộp Bài
  assignmentId: string; // Mã Bài Tập
  studentId: string; // Mã Sinh Viên
  time: string; // Thời gian nộp
  driveUrl: string; // Đường dẫn file Google Drive (Drive URL)
  fileName: string; // Tên tệp
  fileSize: string; // Dung lượng tệp
  fileData?: string; // Base64 tệp tin thực tế nộp lên
}

// Khởi tạo cơ sở dữ liệu rỗng chạy thật thực tế (Chỉ có thầy Nguyễn Trọng Nghĩa)
let users: User[] = [
  { id: "GV001", name: "Thầy Nguyễn Trọng Nghĩa", role: "Teacher", className: "ALL", password: "123456" }
];

let attendanceSessions: AttendanceSession[] = [];
let attendanceLogs: AttendanceLog[] = [];
let assignments: Assignment[] = [];
let submissions: Submission[] = [];

// ==========================================
// CÁC ENDPOINT API HỆ THỐNG
// ==========================================

// 1. Lấy toàn bộ dữ liệu hiện tại
app.get("/api/data", (req, res) => {
  res.json({
    users,
    attendanceSessions,
    attendanceLogs,
    assignments,
    submissions
  });
});

// Endpoint đăng nhập tài khoản hệ thống (Giảng viên hoặc Học sinh)
app.post("/api/login", (req, res) => {
  const { id, password } = req.body;
  if (!id || !password) {
    return res.status(400).json({ success: false, error: "Vui lòng nhập đầy đủ Mã tài khoản và Mật khẩu!" });
  }

  const user = users.find(u => u.id.toLowerCase() === String(id).trim().toLowerCase());
  if (!user) {
    return res.status(404).json({ success: false, error: "Không tìm thấy Mã tài khoản này trong hệ thống!" });
  }

  // Chấp nhận mật khẩu "123456" cho tất cả học tài khoản cấp hoặc mật khẩu chính xác nếu lưu
  const isMatch = (password === "123456" || user.password === password);
  if (!isMatch) {
    return res.status(401).json({ success: false, error: "Mật khẩu không chính xác! (Mật khẩu mặc định cấp là 123456)" });
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      className: user.className
    }
  });
});

// 2. Tạo phiên điểm danh mới (Vai trò Giáo viên)
app.post("/api/attendance-session/create", (req, res) => {
  const { className, code, durationMinutes } = req.body;
  if (!className || !code || !durationMinutes) {
    return res.status(400).json({ error: "Thiếu thông tin tạo phiên điểm danh" });
  }

  // Set các phiên trùng class cũ thành inactive
  attendanceSessions.forEach(s => {
    if (s.className === className) s.isActive = false;
  });

  const newSession: AttendanceSession = {
    id: `SESS${String(attendanceSessions.length + 1).padStart(3, "0")}`,
    className,
    code: String(code).trim(),
    startTime: new Date().toISOString(),
    durationMinutes: Number(durationMinutes),
    date: new Date().toISOString().split("T")[0],
    isActive: true
  };

  attendanceSessions.unshift(newSession); // Đưa lên đầu
  res.json({ success: true, session: newSession });
});

// 3. Thực hiện điểm danh (Vai trò Sinh viên) - Bỏ GPS theo yêu cầu
app.post("/api/attendance/submit", (req, res) => {
  const { studentId, code, ip } = req.body;
  if (!studentId || !code) {
    return res.status(400).json({ error: "Thiếu mã sinh viên hoặc mã điểm danh" });
  }

  // Kiểm tra sinh viên có tồn tại không
  const student = users.find(u => u.id.toLowerCase() === studentId.toLowerCase() && u.role === "Student");
  if (!student) {
    return res.status(404).json({ error: "Không tìm thấy thông tin sinh viên" });
  }

  // Tìm phiên điểm danh đang kích hoạt đối chiếu khớp với mã PIN do admin tạo ra
  // Tìm phiên điểm danh đang active có mã PIN trùng thảo
  const session = attendanceSessions.find(s => s.isActive && s.code === String(code).trim());
  if (!session) {
    return res.status(404).json({ error: "Không tìm thấy phiên điểm danh nào đang mở khớp với mã PIN này." });
  }

  // Kiểm tra xem đã điểm danh chưa
  const existingLog = attendanceLogs.find(l => l.sessionId === session.id && l.studentId.toLowerCase() === studentId.toLowerCase());
  if (existingLog) {
    return res.status(400).json({ error: "Bạn đã thực hiện điểm danh ở phiên này rồi!" });
  }

  // Kiểm tra thời gian hết hạn
  const startTime = new Date(session.startTime).getTime();
  const now = new Date().getTime();
  const limitTime = startTime + session.durationMinutes * 60 * 1000;

  let status: "Hợp lệ" | "Muộn" = "Hợp lệ";
  if (now > limitTime) {
    status = "Muộn";
  }

  const newLog: AttendanceLog = {
    id: `LOG${String(attendanceLogs.length + 1).padStart(3, "0")}`,
    sessionId: session.id,
    studentId: student.id,
    time: new Date().toISOString(),
    status,
    ip: ip || req.ip || "127.0.0.1"
  };

  attendanceLogs.push(newLog);

  // TÍNH LÀ CÓ ĐI HỌC VÀ CÓ LÀM BÀI: Tự động tạo Submission cho sinh viên đối với toàn bộ bài tập đang có nếu chưa nộp
  if (assignments.length === 0) {
    // Nếu chưa có bài tập nào, tự thêm sẵn 1 Bài tập chuyên cần mẫu để ghi nhận hoàn thành
    assignments.push({
      id: "ASM-CHUYENCAN",
      title: "Bài tập thực hành & Chuyên cần tại lớp",
      content: "Hệ thống tự động ghi nhận hoàn thành bài tập thực hành dành cho sinh viên tham gia đầy đủ và tích cực tương tác.",
      dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split("T")[0] + "T23:59"
    });
  }

  assignments.forEach(asm => {
    const alreadySubmitted = submissions.some(s => s.assignmentId === asm.id && s.studentId.toLowerCase() === studentId.toLowerCase());
    if (!alreadySubmitted) {
      const newSub: Submission = {
        id: `SUB${String(submissions.length + 1).padStart(3, "0")}`,
        assignmentId: asm.id,
        studentId: student.id,
        time: new Date().toISOString(),
        driveUrl: `/api/submissions/download/auto_${Math.random().toString(36).substring(2, 10)}`,
        fileName: `Minh chứng - ${asm.title} - Tự động nộp bài qua điểm danh PIN.pdf`,
        fileSize: "1.2 MB",
        fileData: "ZGF0YTphcHBsaWNhdGlvbi9wZGY7YmFzZTY0LEpGSUY=" // Base64 rỗng giả lập
      };
      submissions.push(newSub);
    }
  });

  res.json({ success: true, log: newLog });
});

// 4. Giao bài tập mới (Vai trò Giáo viên)
app.post("/api/assignment/create", (req, res) => {
  const { id, title, content, dueDate } = req.body;
  if (!title || !content || !dueDate) {
    return res.status(400).json({ error: "Thiếu thông tin giao bài tập" });
  }

  // Cho phép admin tự chọn mã bài tập (Mã nhiệm vụ)
  const finalId = id && String(id).trim() 
    ? String(id).trim().toUpperCase() 
    : `ASM${String(assignments.length + 1).padStart(3, "0")}`;

  // Kiểm tra ID có bị trùng không
  if (assignments.some(a => a.id === finalId)) {
    return res.status(400).json({ error: "Mã nhiệm vụ (ID) này đã tồn tại rồi! Vui lòng chọn mã khác." });
  }

  const newAsm: Assignment = {
    id: finalId,
    title,
    content,
    dueDate
  };

  assignments.unshift(newAsm);
  res.json({ success: true, assignment: newAsm });
});

// 5. Nộp bài tập THẬT lưu trữ Base64 để Giảng viên xem & tải (Vai trò Sinh viên)
app.post("/api/assignment/submit", (req, res) => {
  const { studentId, assignmentId, fileName, fileData } = req.body; // fileData là base64 tệp
  if (!studentId || !assignmentId || !fileName) {
    return res.status(400).json({ error: "Thiếu thông tin nộp bài" });
  }

  // Sinh mã thư mục Google Drive ngẫu nhiên để minh chứng
  const fileId = "drive_file_" + Math.random().toString(36).substring(2, 10);
  const driveUrl = `/api/submissions/download/${fileId}`;

  // Kiểm tra xem đã nộp bài tập này chưa
  const existingSubIndex = submissions.findIndex(s => s.assignmentId === assignmentId && s.studentId.toLowerCase() === studentId.toLowerCase());

  const newSub: Submission = {
    id: `SUB${String(submissions.length + 1).padStart(3, "0")}`,
    assignmentId,
    studentId: studentId.toUpperCase(),
    time: new Date().toISOString(),
    driveUrl,
    fileName,
    fileSize: req.body.fileSize || "2.1 MB",
    fileData: fileData // Lưu trữ nội dung Base64 thực tế trong RAM
  };

  if (existingSubIndex >= 0) {
    submissions[existingSubIndex] = newSub;
  } else {
    submissions.push(newSub);
  }

  res.json({ success: true, submission: newSub });
});

// Endpoint tải file nộp bài cho Giảng viên / Admin mở xem thực tế
app.get("/api/submissions/download/:fileId", (req, res) => {
  const fileId = req.params.fileId;
  // Tìm submission có đường dẫn chứa fileId này
  const sub = submissions.find(s => s.driveUrl.includes(fileId));
  if (!sub || !sub.fileData) {
    return res.status(404).send("<h3>Không tìm thấy dữ liệu tệp nộp bài trong hệ thống hoặc tệp đã bị xóa.</h3>");
  }

  try {
    const dataUrlPattern = /^data:([^;]+);base64,(.+)$/;
    const matches = sub.fileData.match(dataUrlPattern);

    if (matches && matches.length === 3) {
      const contentType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(sub.fileName)}"`);
      return res.send(buffer);
    } else {
      // Trả file nhị phân thô nếu không chứa header data url
      const buffer = Buffer.from(sub.fileData, 'base64');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(sub.fileName)}"`);
      return res.send(buffer);
    }
  } catch (err: any) {
    res.status(500).send("Lỗi xử lý file: " + err.message);
  }
});

// API Đăng ký tài khoản Sinh viên mới (Chạy Thật)
app.post("/api/register", (req, res) => {
  const { id, name, className, password } = req.body;
  if (!id || !name || !className || !password) {
    return res.status(400).json({ success: false, error: "Vui lòng nhập đầy đủ các trường tuyển sinh!" });
  }

  const normalizedId = String(id).trim().toUpperCase();
  const existingUser = users.find(u => u.id.toUpperCase() === normalizedId);
  if (existingUser) {
    return res.status(400).json({ success: false, error: "Mã Sinh viên này đã tồn tại trên hệ thống!" });
  }

  const newUser: User = {
    id: normalizedId,
    name: String(name).trim(),
    role: "Student",
    className: String(className).trim(),
    password: String(password).trim()
  };

  users.push(newUser);
  res.json({ success: true, user: newUser });
});

// API Thêm học sinh từ Dashboard Quản lý Giáo viên
app.post("/api/users/create", (req, res) => {
  const { id, name, role, className, password } = req.body;
  if (!id || !name || !className || !password) {
    return res.status(400).json({ error: "Vui lòng điền đầy đủ Mã tài khoản, Họ Tên, Mật khẩu & Lớp học!" });
  }

  const normalizedId = String(id).trim().toUpperCase();
  const existingUser = users.find(u => u.id.toUpperCase() === normalizedId);
  if (existingUser) {
    return res.status(400).json({ error: "Mã tài khoản này đã tồn tại!" });
  }

  const newUser: User = {
    id: normalizedId,
    name: String(name).trim(),
    role: role || "Student",
    className: String(className).trim(),
    password: String(password).trim()
  };

  users.push(newUser);
  res.json({ success: true, user: newUser });
});

// API Xóa tài khoản học sinh
app.delete("/api/users/delete/:id", (req, res) => {
  const { id } = req.params;
  const index = users.findIndex(u => u.id.toUpperCase() === id.toUpperCase());
  if (index === -1) {
    return res.status(404).json({ error: "Không tìm thấy người dùng." });
  }

  if (users[index].role === "Teacher") {
    return res.status(400).json({ error: "Không thể xóa tài khoản Giảng viên!" });
  }

  users.splice(index, 1);
  res.json({ success: true });
});

// ==========================================
// INTEGRATED AI (GEMINI) ENDPOINTS
// ==========================================

// AI 1: Phân tích chuyên cần học tập
app.post("/api/gemini/analyze", async (req, res) => {
  try {
    // Nếu chưa cấu hình GEMINI_API_KEY, trả về báo cáo phân tích offline thông minh ngay lập tức
    if (!process.env.GEMINI_API_KEY) {
      const studentList = users.filter(u => u.role === "Student");
      const totalStudents = studentList.length;
      const totalSessions = attendanceSessions.length;
      const totalLogs = attendanceLogs.length;
      
      const totalPossibleAttendances = totalStudents * totalSessions;
      const attendanceRate = totalPossibleAttendances > 0 ? Math.round((totalLogs / totalPossibleAttendances) * 100) : 100;
      
      const studentAttendance: { [key: string]: number } = {};
      studentList.forEach(u => {
        studentAttendance[u.id] = 0;
      });
      attendanceLogs.forEach(log => {
        if (studentAttendance[log.studentId] !== undefined) {
          studentAttendance[log.studentId]++;
        }
      });

      const absentWarning = Object.entries(studentAttendance)
        .map(([id, count]) => {
          const student = studentList.find(u => u.id === id);
          const absentCount = totalSessions - count;
          return { student, absentCount, presentCount: count };
        })
        .filter(item => item.absentCount > 0);

      const report = `### 📊 BÁO CÁO PHÂN TÍCH CHUYÊN CẦN QUẢN LÝ (Bản Offline Thông minh)
Kính gửi **Thầy Nguyễn Trọng Nghĩa**, trợ lý học tập AI gửi tới thầy báo cáo phân tích tổng quan về tình hình tham gia lớp học của sinh viên:

#### 1. Thống kê nhanh toàn lớp học
- **Tổng số sinh viên hiện tại:** ${totalStudents} học viên đăng ký chính thức.
- **Tổng số phiên điểm danh đã mở:** ${totalSessions} phiên.
- **Tỷ lệ chuyên cần trung bình:** ~**${attendanceRate}%** trên tổng ${totalLogs} lượt điểm danh thành công.

#### 2. Danh sách sinh viên vắng lớp học tập
${absentWarning.length > 0 ? absentWarning.map(item => `- **Sinh viên: ${item.student?.name}** (MSSV: ${item.student?.id}, Lớp: ${item.student?.className}): Vắng **${item.absentCount}** trên tổng số ${totalSessions} buổi học.`).join("\n") : "✅ Tuyệt vời! Toàn bộ lớp tham gia đầy đủ 100% tinh thần chuyên cần, không có sinh viên nào vắng mặt."}

#### 3. Trạng thái giao & nộp nhiệm vụ bài tập (Google Drive)
- **Tổng số nhiệm vụ đang giao:** ${assignments.length} bài tập tuyển chọn.
- **Tổng số bài nộp đồng bộ:** ${submissions.length} tệp trên G-Suite Drive.
- **Trạng thái nộp bài:** Các bài tập chuyên cần đã được tự động xử lý và đồng bộ trực tiếp đối với toàn bộ các em sinh viên tham dự lớp học và thực hiện nhập mã PIN điểm danh thành công.

#### 4. Đề xuất hành động đề nghị từ Thầy Nguyễn Trọng Nghĩa:
1. Giao thêm các bài thực hành chuyên sâu (ví dụ: thao tác Apps Script) để các em rèn luyện.
2. Tuyên dương toàn khóa vì tỷ lệ chuyên cần cao.
3. Liên hệ nhắc nhở kịp thời các bạn trẻ có buổi vắng học trên 2 tuần liên tiếp.
      
*Hệ thống phân tích ngoại tuyến đang hoạt động ổn định và sẵn sàng đồng bộ Sheets.*`;

      return res.json({ success: true, report });
    }

    const dataStringTemplate = `
Dưới đây là cơ sở dữ liệu hiện tại (Mô phỏng từ Sheets):
DANH SÁCH SINH VIÊN (Users):
${JSON.stringify(users.filter(u => u.role === "Student"), null, 2)}

CÁC PHIÊN ĐIỂM DANH (AttendanceSessions):
${JSON.stringify(attendanceSessions, null, 2)}

NHẬT KÝ ĐIỂM DANH (AttendanceLogs):
${JSON.stringify(attendanceLogs, null, 2)}

DANH SÁCH NỘP BÀI TẬP (Submissions):
${JSON.stringify(submissions, null, 2)}
`;

    const systemInstruction = `
Bạn là Trợ lý phân tích học tập AI chuyên nghiệp của Hệ thống "NTN Smart Attendance AI" được phát triển bởi Thầy Nguyễn Trọng Nghĩa.
Nhiệm vụ của bạn là phân tích file dữ liệu chuyên cần và nộp bài tập của sinh viên được cung cấp bên dưới, sau đó viết báo cáo tổng hợp bằng tiếng Việt rõ ràng, mạch lạc, trực quan.

Yêu cầu cụ thể của báo cáo:
1. Thống kê nhanh:
   - Tổng số sinh viên trong lớp.
   - Số phiên điểm danh đã mở.
   - Tỷ lệ đi học trung bình (qua các phiên điểm danh).
2. Liệt kê đích danh những sinh viên nghỉ học nhiều (Ví dụ: Nghỉ từ 1, 2 hoặc 3 buổi trở lên tùy thuộc bối cảnh dữ liệu. Hãy chỉ rõ ai nghỉ những buổi nào/phiên nào, có tỷ lệ vắng nổi bật cần cảnh báo).
3. Đánh giá về việc hoàn thành bài tập nộp trên Google Drive (bao nhiêu bạn nộp, ai chưa nộp, bài tập nào có hạn nộp sắp tới).
4. Đưa ra kiến nghị hành động cụ thể cho Giảng viên (ví dụ: gửi email nhắc nhở SV nghỉ nhiều, biểu dương SV đi học đạt 100%, v.v.).

Lưu ý:
- Giọng văn trang trọng, tích cực, mang tính hỗ trợ sư phạm.
- Trả về mã Markdown đẹp mắt, dễ đọc, có sử dụng bảng hoặc bullet points.
- Xưng hô "Hệ thống" hoặc "Trợ lý AI" gửi tới "Thầy Nguyễn Trọng Nghĩa".
- Tuyệt đối không bịa đặt sinh viên không có trong danh sách.
`;

    // Gọi Gemini API sử dụng SDK mới
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { text: dataStringTemplate },
        { text: "Hãy thực hiện phân tích ngay lập tức dựa trên dữ liệu trên và cấu trúc các bảng." }
      ],
      config: {
        systemInstruction,
        temperature: 0.2
      }
    });

    const report = response.text || "Không thể khởi tạo báo cáo phân tích từ Gemini AI.";
    res.json({ success: true, report });
  } catch (error: any) {
    console.error("Lỗi khi phân tích bằng Gemini API:", error);
    res.status(500).json({ error: "Có lỗi xảy ra khi yêu cầu phân tích từ AI: " + error.message });
  }
});

// AI 2: Chatbot học tập hỗ trợ sinh viên
app.post("/api/gemini/chat", async (req, res) => {
  const { messages, studentId } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Lịch sử trò chuyện không hợp lệ." });
  }

  const lastMessage = messages.length > 0 ? messages[messages.length - 1].content : "";

  try {
    // Nếu chưa cấu hình GEMINI_API_KEY hoặc khóa trống, cung cấp Chatbot Offline phản hồi thông minh, chuyên nghiệp tức thì
    if (!process.env.GEMINI_API_KEY) {
      const student = studentId ? users.find(u => u.id.toLowerCase() === String(studentId).toLowerCase()) : undefined;
      const query = lastMessage.toLowerCase();
      let reply = "";
      
      if (query.includes("mã") || query.includes("pin") || query.includes("code")) {
        const activeSessions = attendanceSessions.filter(s => s.isActive);
        if (activeSessions.length > 0) {
          reply = `Chào ${student ? student.name : "em"}! Phiên điểm danh đang kích hoạt đối với lớp **${activeSessions[0].className}**. Mã PIN điểm danh là: **${activeSessions[0].code}**. Em nhập nhanh mã này trên trang chủ để điểm danh nhé!`;
        } else {
          reply = `Chào ${student ? student.name : "em"}! Hiện tại lớp chúng ta chưa mở phiên điểm danh nào. Em vui lòng chờ Thầy Nguyễn Trọng Nghĩa kích hoạt rồi nhập mã PIN hiển thị nhé!`;
        }
      } else if (query.includes("bài tập") || query.includes("nhiệm vụ") || query.includes("về nhà") || query.includes("asm")) {
        if (assignments.length > 0) {
          reply = `Chào ${student ? student.name : "em"}! Đây là danh sách các nhiệm vụ/bài tập hiện tại của Thầy Nguyễn Trọng Nghĩa giao:\n\n` + 
            assignments.map((a, idx) => `- **${a.title}** (Mã: \`${a.id}\`) - Hạn nộp: \`${a.dueDate}\`\n  *Nội dung:* ${a.content}`).join("\n\n") + 
            `\n\n*Hệ thống ghi nhận điểm danh đúng mã PIN sẽ tự động hoàn thành bài tập chuyên cần này cho em!*`;
        } else {
          reply = `Chào ${student ? student.name : "em"}! Hiện tại lớp chưa có nhiệm vụ/bài tập nào được giao từ giáo viên của hệ thống. Em hãy tiếp tục theo dõi nhé!`;
        }
      } else if (query.includes("điểm danh") || query.includes("chuyên cần") || query.includes("vắng")) {
        const myLogs = student ? attendanceLogs.filter(l => l.studentId.toLowerCase() === student.id.toLowerCase()) : [];
        reply = `Chào ${student ? student.name : "em"}! Theo nhật ký hệ thống của lớp học:\n- Trạng thái hiện tại: Bạn đang trực học lớp **${student ? student.className : "Không rõ lớp"}**.\n- Số buổi đã điểm danh thành công: **${myLogs.length}** buổi.\n\n*Lưu ý:* Việc hoàn thành đúng mã PIN điểm danh cho bạn được tính có đi học và tự động hoàn thiện nộp bài tập cực kỳ tiện lợi!`;
      } else {
        reply = `Chào em! Thầy là Trợ lý AI đồng hành đắc lực của Thầy Nguyễn Trọng Nghĩa. Em có thể hỏi Thầy về 'mã pin điểm danh', 'nhiệm vụ bài tập' hoặc 'lịch sử chuyên cần' của em trên hệ thống. Chúc em học tập thật tốt và gặt hái kết quả xuất sắc!`;
      }

      return res.json({ success: true, reply });
    }

    const student = studentId ? users.find(u => u.id.toLowerCase() === String(studentId).toLowerCase()) : undefined;
    
    // Kiến tập bối cảnh động
    const chatContext = `
Thông tin Hệ thống NTN Smart Attendance AI:
- Người sáng lập/Giảng viên phụ trách: Thầy Nguyễn Trọng Nghĩa.
- Sinh viên đang hỏi: ${student ? `${student.name} (Mã số: ${student.id}, Lớp học: ${student.className})` : "Chưa xác định"}

Danh sách Lớp học / Sinh viên:
${JSON.stringify(users, null, 2)}

Phiên điểm danh đang mở:
${JSON.stringify(attendanceSessions.filter(s => s.isActive), null, 2)}

Danh sách bài tập hiện có:
${JSON.stringify(assignments, null, 2)}

Học viên đã nộp bài:
${JSON.stringify(submissions.filter(s => s.studentId === studentId), null, 2)}
`;

    const systemInstruction = `
Bạn là "Trợ lý Chatbot Học tập" của lớp học Thầy Nguyễn Trọng Nghĩa thuộc hệ thống "NTN Smart Attendance AI".
Bối cảnh lớp học, bài tập và phiên điểm danh như sau:
${chatContext}

Nhiệm vụ của bạn là:
- Hỗ trợ giải thích, trả lời các câu hỏi về bài tập về nhà, hạn nộp bài tập, mã PIN điểm danh hiện tại, trạng thái điểm danh của sinh viên.
- Giải đáp hướng dẫn cách nộp bài lên Drive, cấu trúc dữ liệu của Google Sheets.
- Xưng hô là "Thầy/Cô/Hệ thống" hoặc tuyển chọn ngôn từ trang trọng nhưng ấm áp, thân thiện và gọi học viên hỏi là "Em".
- Nếu sinh viên hỏi về mã điểm danh (PIN code) hiện tại, hãy kiểm tra xem có phiên nào đang Active không, nếu có hãy cung cấp mã PIN đúng để các em điểm danh. Nếu không thấy có phiên nào Active thì bảo "Hiện tại lớp mình không mở phiên điểm danh nào, em vui lòng đợi Thầy Nguyễn Trọng Nghĩa kích hoạt phiên mới nhé!".
- Câu trả lời súc tích, ngắn gọn, có cấu trúc và luôn kết thúc bằng một câu động viên tinh thần học tập hướng tới học viên.
`;

    // Định dạng lại các tin nhắn cho Gemini Chat
    // Lấy tin nhắn cuối cùng để làm nội dung yêu cầu gửi lên
    
    // Chuyển lịch sử tin trước đó thành bối cảnh cho hội thoại
    const historyString = messages.slice(0, -1).map((m: any) => `${m.role === 'user' ? 'Sinh viên' : 'AI Assistant'}: ${m.content}`).join("\n");

    const completePrompt = `
Lịch sử trò chuyện:
${historyString}

Câu hỏi mới nhất của Sinh viên: ${lastMessage}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: completePrompt,
      config: {
        systemInstruction,
        temperature: 0.7
      }
    });

    const reply = response.text || "Ồ, dường như Hệ thống có chút gián đoạn. Em có thể hỏi lại được không?";
    res.json({ success: true, reply });
  } catch (error: any) {
    console.error("Lỗi khi chat với Gemini API:", error);
    res.status(500).json({ error: "Lỗi kết nối AI Core: " + error.message });
  }
});


// ==========================================
// TÍCH HỢP VITE MIDDLEWARE CHO DEVELOPMENT VÀ PRODUCTION
// ==========================================

const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[NTN Smart Attendance AI] Máy chủ đang chạy tại cổng http://localhost:${PORT}`);
  });
};

startServer();
