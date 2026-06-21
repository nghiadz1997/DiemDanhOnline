import React, { useState, useEffect } from "react";
import { 
  Users, 
  MapPin, 
  BookOpen, 
  FolderDown, 
  MessageSquare, 
  Sparkles, 
  Plus, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Upload, 
  Send, 
  ChevronRight, 
  RefreshCw, 
  User, 
  Calendar,
  AlertTriangle,
  Info,
  Copy,
  Check,
  FileCheck,
  CircleDot,
  Search,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  Maximize2,
  MessageCircle,
  Menu,
  X
} from "lucide-react";
import GoogleAppsScriptCode from "./components/GoogleAppsScriptCode";
import { AttendanceChart } from "./components/AttendanceChart";
import { DatabaseState, AttendanceSession, AttendanceLog, Assignment, Submission, User as AppUser, ChatMessage } from "./types";

export default function App() {
  // Trạng thái đăng nhập tài khoản
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem("nsg_auth_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  // Một số state bổ sung phục vụ form đăng nhập
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginRole, setLoginRole] = useState<"Teacher" | "Student">("Student");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Vai trò hiện tại: Teacher hoặc Student
  const [currentRole, setCurrentRole] = useState<"Teacher" | "Student">("Teacher");
  
  // Tab hiện tại đang chọn của Sidebar
  const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "assignments" | "gas" | "chat">("overview");

  // State quản lý dữ liệu
  const [db, setDb] = useState<DatabaseState>({
    users: [],
    attendanceSessions: [],
    attendanceLogs: [],
    assignments: [],
    submissions: []
  });

  // State loading và thông báo liên quan
  const [loading, setLoading] = useState(true);
  const [fetchingReport, setFetchingReport] = useState(false);
  const [aiReport, setAiReport] = useState<string>("");

  // Điểm danh (Student input)
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [attendanceMessage, setAttendanceMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form tự đăng ký tài khoản (Student self-registration)
  const [isRegistering, setIsRegistering] = useState(false);
  const [regId, setRegId] = useState("");
  const [regName, setRegName] = useState("");
  const [regClassName, setRegClassName] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regError, setRegError] = useState("");

  // Form thêm học sinh từ Dashboard Giáo viên
  const [addStudentId, setAddStudentId] = useState("");
  const [addStudentName, setAddStudentName] = useState("");
  const [addStudentClass, setAddStudentClass] = useState("");
  const [addStudentPassword, setAddStudentPassword] = useState("123456");

  // State xem trước bài nộp trực tiếp (In-app file viewer)
  const [previewSubmission, setPreviewSubmission] = useState<Submission | null>(null);

  // Giao bài tập & Tạo phiên điểm danh (Teacher input)
  const [newSessionClass, setNewSessionClass] = useState("");
  const [newSessionMinutes, setNewSessionMinutes] = useState(15);
  const [newSessionCode, setNewSessionCode] = useState("");
  const [newAsmId, setNewAsmId] = useState("");
  const [newAsmTitle, setNewAsmTitle] = useState("");
  const [newAsmContent, setNewAsmContent] = useState("");
  const [newAsmDueDate, setNewAsmDueDate] = useState("2026-06-30T23:59");

  // Nộp bài tập (Student file submission)
  const [selectedAsmId, setSelectedAsmId] = useState("");
  const [studentSubmissionFile, setStudentSubmissionFile] = useState<File | null>(null);
  const [isSubmittingFile, setIsSubmittingFile] = useState(false);
  const [fileSubmitMessage, setFileSubmitMessage] = useState<{ type: "success" | "error"; text: string, link?: string } | null>(null);

  // Nhóm Chat Lớp
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "MSG_INIT_1",
      senderId: "ADMIN",
      senderName: "Thầy Nguyễn Trọng Nghĩa",
      senderRole: "Teacher",
      content: "Chào mừng cả lớp đến với nhóm chat chung! Nơi các em có thể hỏi bài học, trao đổi học thuật, và gửi trực tiếp hình ảnh bài tập/góp ý cho Thầy hoặc các bạn nhé. Chúc các em học tập vui vẻ! 🎯📚",
      time: new Date(Date.now() - 3600 * 1000 * 2).toISOString()
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [chatImage, setChatImage] = useState<string | null>(null); // Base64 string
  const [chatImageFilename, setChatImageFilename] = useState<string>("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  
  // Trạng thái mở/đóng Sidebar trên điện thoại/IPad
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Khởi tạo Database offline từ LocalStorage hoặc dữ liệu mặc định ban đầu
  const getLocalDB = () => {
    const raw = localStorage.getItem("ntn_local_db");
    if (!raw) {
      const initDb = {
        users: [
          { id: "admin", name: "Thầy Nguyễn Trọng Nghĩa", role: "Teacher", className: "ALL", password: "Nsg@2026" }
        ],
        attendanceSessions: [],
        attendanceLogs: [],
        assignments: [],
        submissions: []
      };
      localStorage.setItem("ntn_local_db", JSON.stringify(initDb));
      return initDb;
    }
    try {
      return JSON.parse(raw);
    } catch {
      const initDb = {
        users: [
          { id: "admin", name: "Thầy Nguyễn Trọng Nghĩa", role: "Teacher", className: "ALL", password: "Nsg@2026" }
        ],
        attendanceSessions: [],
        attendanceLogs: [],
        assignments: [],
        submissions: []
      };
      localStorage.setItem("ntn_local_db", JSON.stringify(initDb));
      return initDb;
    }
  };

  const saveLocalDB = (newDb: any) => {
    localStorage.setItem("ntn_local_db", JSON.stringify(newDb));
    setDb(newDb);
  };

  // Lấy dữ liệu từ backend local khi mount
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/data");
      const text = await res.text();
      let parseSuccess = false;
      try {
        const data = JSON.parse(text);
        if (data && typeof data === "object" && data.users) {
          setDb(data);
          localStorage.setItem("ntn_local_db", JSON.stringify(data));
          setIsOfflineMode(false);
          parseSuccess = true;
          if (data.chatMessages) {
            setChatMessages(data.chatMessages);
          }
          if (data.assignments && data.assignments.length > 0 && !selectedAsmId) {
            setSelectedAsmId(data.assignments[0].id);
          }
        }
      } catch (e) {
        console.warn("Dữ liệu mạng không phải JSON hợp lệ, tự động kích hoạt Chế độ Offline Standalone.", e);
      }

      if (!parseSuccess) {
        // Chạy Local Fallback
        setIsOfflineMode(true);
        const ldb = getLocalDB();
        setDb(ldb);
        if (ldb.assignments && ldb.assignments.length > 0 && !selectedAsmId) {
          setSelectedAsmId(ldb.assignments[0].id);
        }
      }
    } catch (err) {
      console.warn("Không kết nối được server, chuyển sang Chế độ Offline Standalone.", err);
      setIsOfflineMode(true);
      const ldb = getLocalDB();
      setDb(ldb);
      if (ldb.assignments && ldb.assignments.length > 0 && !selectedAsmId) {
        setSelectedAsmId(ldb.assignments[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchDataSilent = async () => {
    try {
      const res = await fetch("/api/data");
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (data && typeof data === "object" && data.users) {
          setDb(data);
          localStorage.setItem("ntn_local_db", JSON.stringify(data));
          setIsOfflineMode(false);
          if (data.chatMessages) {
            setChatMessages(data.chatMessages);
          }
        }
      } catch (e) {
        // Thất bại âm thầm
      }
    } catch (err) {
      // Thất bại âm thầm
    }
  };

  useEffect(() => {
    fetchData();
    // Tự sinh mã PIN ngẫu nhiên cho form giáo viên tạo
    generateRandomPin();

    // Bắt đầu chế độ tự động đồng bộ / polling nhóm chat lớp mỗi 4 giây
    const interval = setInterval(() => {
      fetchDataSilent();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Tự động đồng bộ vai trò và mã sinh viên khi đăng nhập
  useEffect(() => {
    if (currentUser) {
      setCurrentRole(currentUser.role === "Teacher" ? "Teacher" : "Student");
      if (currentUser.role === "Student") {
        setSelectedStudentId(currentUser.id);
        setActiveTab("attendance"); // Students default to attendance tab
      } else {
        setActiveTab("overview"); // Teachers default to overview dashboard
      }
    }
  }, [currentUser]);

  // Hành động Đăng nhập
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      if (!isOfflineMode) {
        try {
          const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: loginId.trim(),
              password: loginPassword
            })
          });
          const text = await res.text();
          const data = JSON.parse(text);
          if (data.success) {
            localStorage.setItem("nsg_auth_user", JSON.stringify(data.user));
            setCurrentUser(data.user);
            setLoginLoading(false);
            return;
          } else {
            setLoginError(data.error || "Mã tài khoản hoặc mật khẩu không đúng!");
            setLoginLoading(false);
            return;
          }
        } catch (apiErr) {
          console.warn("Gọi API login thất bại, chạy local login fallback", apiErr);
          setIsOfflineMode(true);
        }
      }

      // Local login fallback
      const ldb = getLocalDB();
      const matchedUser = ldb.users.find(
        (u: any) => u.id.toLowerCase() === loginId.trim().toLowerCase() && u.password === loginPassword
      );
      if (matchedUser) {
        const publicUser = { id: matchedUser.id, name: matchedUser.name, role: matchedUser.role, className: matchedUser.className };
        localStorage.setItem("nsg_auth_user", JSON.stringify(publicUser));
        setCurrentUser(publicUser);
      } else {
        setLoginError("Mã tài khoản hoặc mật khẩu không đúng!");
      }
    } catch (err: any) {
      setLoginError("Không thể kết nối máy chủ xác thực: " + err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  // Hành động Đăng ký tự động (Sinh viên tự tuyển sinh/tạo tài khoản)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    if (!regId || !regName || !regClassName || !regPassword) {
      setRegError("Vui lòng nhập trọn vẹn thông tin đăng ký!");
      return;
    }

    const finalRegId = regId.trim().toUpperCase();
    const finalRegName = regName.trim();
    const finalRegClassName = regClassName.trim();

    try {
      if (!isOfflineMode) {
        try {
          const res = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: finalRegId,
              name: finalRegName,
              className: finalRegClassName,
              password: regPassword
            })
          });
          const text = await res.text();
          const data = JSON.parse(text);
          if (res.ok && data.success) {
            alert(`Chúc mừng ${finalRegName}! Đã đăng ký tài khoản thành công.`);
            setLoginId(finalRegId);
            setLoginPassword(regPassword);
            setLoginRole("Student");
            setIsRegistering(false);
            setRegId("");
            setRegName("");
            setRegPassword("");
            fetchData();
            return;
          } else {
            setRegError(data.error || "Mã sinh viên này đã có người đăng ký!");
            return;
          }
        } catch (apiErr) {
          console.warn("Gọi API register thất bại, chạy local register fallback", apiErr);
          setIsOfflineMode(true);
        }
      }

      // Local register fallback
      const ldb = getLocalDB();
      const userExists = ldb.users.some((u: any) => u.id.toLowerCase() === finalRegId.toLowerCase());
      if (userExists) {
        setRegError("Mã sinh viên này đã có người đăng ký trong cơ sở dữ liệu!");
      } else {
        const newUser = {
          id: finalRegId,
          name: finalRegName,
          role: "Student" as const,
          className: finalRegClassName,
          password: regPassword
        };
        ldb.users.push(newUser);
        saveLocalDB(ldb);
        alert(`Chúc mừng ${finalRegName}! Đã đăng ký tài khoản thành công (Offline Mode).`);
        setLoginId(finalRegId);
        setLoginPassword(regPassword);
        setLoginRole("Student");
        setIsRegistering(false);
        setRegId("");
        setRegName("");
        setRegPassword("");
        fetchData();
      }
    } catch (err: any) {
      setRegError("Lỗi kết nối máy chủ đăng ký: " + err.message);
    }
  };

  // Hành động Đăng xuất
  const handleLogout = () => {
    localStorage.removeItem("nsg_auth_user");
    setCurrentUser(null);
    setLoginId("");
    setLoginPassword("");
    setLoginError("");
    setAttendanceMessage(null);
    setFileSubmitMessage(null);
  };

  const generateRandomPin = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setNewSessionCode(code);
  };

  // Hàm sao chép mã PIN học tập có hỗ trợ fallback an toàn cho Sandbox iFrame
  const handleCopyCode = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      alert(`Đã sao chép thành công mã PIN: ${text}`);
    } else {
      // Fallback cho trình duyệt chặn sao chép thông thường trong iframe
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          alert(`Đã sao chép thành công mã PIN: ${text}`);
        } else {
          alert(`Vui lòng bôi đen và sao chép thủ công hệ số PIN: ${text}`);
        }
      } catch (err) {
        alert("Bình thường hóa quyền sao chép, vui lòng nhập thủ công: " + text);
      }
      document.body.removeChild(textArea);
    }
  };

  // 1. Tạo phiên điểm danh mới (Teacher Action)
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeToSend = newSessionCode || Math.floor(100000 + Math.random() * 900000).toString();
    try {
      if (!isOfflineMode) {
        try {
          const res = await fetch("/api/attendance-session/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              className: newSessionClass,
              code: codeToSend,
              durationMinutes: newSessionMinutes
            })
          });
          const text = await res.text();
          const data = JSON.parse(text);
          if (data.success) {
            alert(`Kích hoạt phiên điểm danh thành công! Mã PIN học tập mới: ${codeToSend}`);
            fetchData();
            generateRandomPin();
            return;
          } else {
            alert("Lỗi: " + data.error);
            return;
          }
        } catch (apiErr) {
          console.warn("Gọi API create session thất bại, chạy local fallback", apiErr);
          setIsOfflineMode(true);
        }
      }

      // Local fallback
      const ldb = getLocalDB();
      ldb.attendanceSessions = ldb.attendanceSessions.map((s: any) => {
        if (s.className.toLowerCase() === newSessionClass.toLowerCase()) {
          return { ...s, isActive: false };
        }
        return s;
      });

      const newSession = {
        id: "SES" + String(ldb.attendanceSessions.length + 1).padStart(3, "0"),
        className: newSessionClass,
        code: codeToSend,
        startTime: new Date().toISOString(),
        durationMinutes: Number(newSessionMinutes),
        date: new Date().toISOString().split("T")[0],
        isActive: true
      };
      
      ldb.attendanceSessions.push(newSession);
      saveLocalDB(ldb);
      alert(`Kích hoạt phiên điểm danh thành công! Mã PIN học tập mới (Offline Mode): ${codeToSend}`);
      fetchData();
      generateRandomPin();
    } catch (err: any) {
      alert("Lỗi kết nối máy chủ: " + err.message);
    }
  };

  // 2. Điểm danh (Student Action) - Đã bỏ kiểm tra định vị GPS
  const handleSubmitAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttendanceMessage(null);
    if (!pinCode) {
      setAttendanceMessage({ type: "error", text: "Vui lòng nhập mã PIN gồm 6 chữ số!" });
      return;
    }

    try {
      if (!isOfflineMode) {
        try {
          const res = await fetch("/api/attendance/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId: selectedStudentId,
              code: pinCode,
              ip: "192.168.1." + Math.floor(Math.random() * 200 + 1) // Giả lập IP mạng trường
            })
          });

          const text = await res.text();
          const data = JSON.parse(text);
          if (data.success) {
            setAttendanceMessage({ 
              type: "success", 
              text: `Chúc mừng bạn! Điểm danh thành công lớp học. Trạng thái: ${data.log.status}` 
            });
            setPinCode("");
            fetchData();
            return;
          } else {
            setAttendanceMessage({ type: "error", text: data.error });
            return;
          }
        } catch (apiErr) {
          console.warn("Gọi API submit attendance thất bại, chạy local fallback", apiErr);
          setIsOfflineMode(true);
        }
      }

      // Local fallback
      const ldb = getLocalDB();
      const student = ldb.users.find((u: any) => u.id.toLowerCase() === selectedStudentId.toLowerCase());
      if (!student) {
        setAttendanceMessage({ type: "error", text: "Không tìm thấy thông tin sinh viên" });
        return;
      }

      const session = ldb.attendanceSessions.find((s: any) => s.isActive && s.code === String(pinCode).trim());
      if (!session) {
        setAttendanceMessage({ type: "error", text: "Không tìm thấy phiên điểm danh nào đang mở khớp với mã PIN này." });
        return;
      }

      const alreadyAttended = ldb.attendanceLogs.some(
        (log: any) => log.sessionId === session.id && log.studentId.toLowerCase() === student.id.toLowerCase()
      );
      if (alreadyAttended) {
        setAttendanceMessage({ type: "error", text: "Bạn đã được hệ thống ghi nhận điểm danh rồi! Không cần nộp lại." });
        return;
      }

      const timeDiff = (Date.now() - new Date(session.startTime).getTime()) / 60000;
      const status = timeDiff <= session.durationMinutes ? "Hợp lệ" : "Muộn";
      
      const newLog = {
        id: "LOG" + String(ldb.attendanceLogs.length + 1).padStart(3, "0"),
        sessionId: session.id,
        studentId: student.id,
        time: new Date().toISOString(),
        status: status as any,
        ip: "192.168.1." + Math.floor(Math.random() * 200 + 1)
      };
      ldb.attendanceLogs.push(newLog);

      ldb.assignments.forEach((asm: any) => {
        const alreadySubbed = ldb.submissions.some(
          (s: any) => s.assignmentId === asm.id && s.studentId.toLowerCase() === student.id.toLowerCase()
        );
        if (!alreadySubbed) {
          const newSub = {
            id: `SUB${String(ldb.submissions.length + 1).padStart(3, "0")}`,
            assignmentId: asm.id,
            studentId: student.id,
            time: new Date().toISOString(),
            driveUrl: `/api/submissions/download/auto_${Math.random().toString(36).substring(2, 10)}`,
            fileName: `Minh chứng - ${asm.title} - Tự động nộp bài qua điểm danh PIN.pdf`,
            fileSize: "1.2 MB"
          };
          ldb.submissions.push(newSub);
        }
      });

      saveLocalDB(ldb);
      setAttendanceMessage({ 
        type: "success", 
        text: `Chúc mừng bạn! Điểm danh thành công (Offline Mode). Trạng thái: ${status}` 
      });
      setPinCode("");
      fetchData();
    } catch (err: any) {
      setAttendanceMessage({ type: "error", text: "Lỗi kết nối máy chủ điểm danh: " + err.message });
    }
  };

  // 3. Giao bài tập mới (Teacher Action)
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsmTitle || !newAsmContent) {
      alert("Hãy điền trọn vẹn Tiêu đề và Nội dung hướng dẫn!");
      return;
    }
    try {
      if (!isOfflineMode) {
        try {
          const res = await fetch("/api/assignment/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: newAsmId,
              title: newAsmTitle,
              content: newAsmContent,
              dueDate: newAsmDueDate
            })
          });
          const text = await res.text();
          const data = JSON.parse(text);
          if (data.success) {
            alert("Giao bài tập lên hệ thống Google Drive/Sheets thành công!");
            setNewAsmId("");
            setNewAsmTitle("");
            setNewAsmContent("");
            fetchData();
            return;
          } else {
            alert("Có lỗi: " + data.error);
            return;
          }
        } catch (apiErr) {
          console.warn("Giao bài tập API thất bại, chạy local fallback", apiErr);
          setIsOfflineMode(true);
        }
      }

      // Local fallback
      const ldb = getLocalDB();
      const finalId = newAsmId && newAsmId.trim()
        ? newAsmId.trim().toUpperCase()
        : `ASM${String(ldb.assignments.length + 1).padStart(3, "0")}`;

      if (ldb.assignments.some((a: any) => a.id === finalId)) {
        alert("Mã nhiệm vụ (ID) này đã tồn tại rồi! Vui lòng chọn mã khác.");
        return;
      }

      const newAsm = {
        id: finalId,
        title: newAsmTitle.trim(),
        content: newAsmContent.trim(),
        dueDate: newAsmDueDate
      };

      ldb.assignments.push(newAsm);
      saveLocalDB(ldb);
      alert("Giao bài tập thành công (Môi trường Offline cục bộ)!");
      setNewAsmId("");
      setNewAsmTitle("");
      setNewAsmContent("");
      fetchData();
    } catch (err: any) {
      alert("Lỗi kết nối: " + err.message);
    }
  };

  // 4. Nộp bài tập (Student Action)
  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFileSubmitMessage(null);
    if (!studentSubmissionFile) {
      setFileSubmitMessage({ type: "error", text: "Vui lòng chọn hoặc kéo thả một tệp minh chứng bài làm trước!" });
      return;
    }

    setIsSubmittingFile(true);
    
    // Giả lập đọc base64 của file và gửi lên Express Server
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (!isOfflineMode) {
          try {
            const res = await fetch("/api/assignment/submit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                studentId: selectedStudentId,
                assignmentId: selectedAsmId,
                fileName: studentSubmissionFile.name,
                fileData: reader.result // Base64 data
              })
            });

            const text = await res.text();
            const data = JSON.parse(text);
            if (data.success) {
              setFileSubmitMessage({
                type: "success",
                text: `🎉 Nộp bài thành công! File đã được tự động lưu trữ vào Thư mục Google Drive của giảng viên và tạo liên kết chia sẻ quyền xem.`,
                link: data.submission.driveUrl
              });
              setStudentSubmissionFile(null);
              fetchData();
              setIsSubmittingFile(false);
              return;
            } else {
              setFileSubmitMessage({ type: "error", text: data.error });
              setIsSubmittingFile(false);
              return;
            }
          } catch (apiErr) {
            console.warn("Nộp file qua API thất bại, chạy local fallback", apiErr);
            setIsOfflineMode(true);
          }
        }

        // Local fallback
        const ldb = getLocalDB();
        const subId = `SUB${String(ldb.submissions.length + 1).padStart(3, "0")}`;
        const newSub = {
          id: subId,
          assignmentId: selectedAsmId,
          studentId: selectedStudentId,
          time: new Date().toISOString(),
          driveUrl: `/api/submissions/download/offline_${subId}`,
          fileName: studentSubmissionFile.name,
          fileSize: (studentSubmissionFile.size / (1024 * 1024)).toFixed(1) + " MB",
          fileData: reader.result // Store Base64 data locally
        };

        // Xóa submission cũ nếu có trùng lặp
        ldb.submissions = ldb.submissions.filter(
          (s: any) => !(s.assignmentId === selectedAsmId && s.studentId.toLowerCase() === selectedStudentId.toLowerCase())
        );

        ldb.submissions.push(newSub);
        saveLocalDB(ldb);

        setFileSubmitMessage({
          type: "success",
          text: `🎉 Nộp bài thành công (Offline Mode)! File đã được giả lập lưu trữ dữ liệu nén trong trình duyệt của bạn.`,
          link: newSub.driveUrl
        });
        setStudentSubmissionFile(null);
        fetchData();
        setIsSubmittingFile(false);
      } catch (err: any) {
        setFileSubmitMessage({ type: "error", text: "Lỗi upload lên Google Drive: " + err.message });
        setIsSubmittingFile(false);
      }
    };

    reader.readAsDataURL(studentSubmissionFile);
  };

  // 4a. Giáo viên thêm sinh viên mới
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addStudentId || !addStudentName || !addStudentClass) {
      alert("Vui lòng điền đầy đủ Mã sinh viên, Họ tên và Tên lớp!");
      return;
    }

    const sId = addStudentId.trim();
    const sName = addStudentName.trim();
    const sClass = addStudentClass.trim();
    const sPass = addStudentPassword.trim() || "123456";

    try {
      if (!isOfflineMode) {
        try {
          const res = await fetch("/api/users/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: sId,
              name: sName,
              className: sClass,
              password: sPass,
              role: "Student"
            })
          });
          const text = await res.text();
          const data = JSON.parse(text);
          if (res.ok && data.success !== false) {
            alert(`Đã thêm thành công sinh viên: ${sName}`);
            setAddStudentId("");
            setAddStudentName("");
            setAddStudentPassword("123456"); // Mặc định reset
            fetchData();
            return;
          } else {
            alert("Lỗi: " + (data.error || "Không thể tạo tài khoản"));
            return;
          }
        } catch (apiErr) {
          console.warn("Tạo người dùng qua API thất bại, chạy local fallback", apiErr);
          setIsOfflineMode(true);
        }
      }

      // Local fallback
      const ldb = getLocalDB();
      if (ldb.users.some((u: any) => u.id.toLowerCase() === sId.toLowerCase())) {
        alert("Mã sinh viên này đã có sẵn trong danh sách!");
        return;
      }

      const newUser = {
        id: sId,
        name: sName,
        className: sClass,
        role: "Student" as const,
        password: sPass
      };

      ldb.users.push(newUser);
      saveLocalDB(ldb);
      alert(`Đã thêm thành công sinh viên (Offline Mode): ${sName}`);
      setAddStudentId("");
      setAddStudentName("");
      setAddStudentPassword("123456");
      fetchData();
    } catch (err: any) {
      alert("Lỗi kết nối máy chủ quản lý: " + err.message);
    }
  };

  // 4b. Giáo viên xóa sinh viên
  const handleDeleteStudent = async (studentId: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản sinh viên ${name} (${studentId}) khỏi danh sách?`)) {
      return;
    }
    try {
      if (!isOfflineMode) {
        try {
          const res = await fetch(`/api/users/delete/${studentId}`, {
            method: "DELETE"
          });
          const text = await res.text();
          const data = JSON.parse(text);
          if (res.ok && data.success !== false) {
            alert("Đã xóa sinh viên thành công khỏi hệ thống!");
            fetchData();
            return;
          } else {
            alert("Lỗi: " + (data.error || "Không thể xóa"));
            return;
          }
        } catch (apiErr) {
          console.warn("Xóa người dùng qua API thất bại, chạy local fallback", apiErr);
          setIsOfflineMode(true);
        }
      }

      // Local fallback
      const ldb = getLocalDB();
      ldb.users = ldb.users.filter((u: any) => u.id.toLowerCase() !== studentId.toLowerCase());
      saveLocalDB(ldb);
      alert("Đã xóa sinh viên thành công khỏi hệ thống (Offline Mode)!");
      fetchData();
    } catch (err: any) {
      alert("Lỗi máy chủ khi xóa: " + err.message);
    }
  };

  // 5. Yêu cầu Gemini AI phân tích dữ liệu chuyên cần
  const handleRequestAIReport = async () => {
    setFetchingReport(true);
    setAiReport("");
    try {
      if (!isOfflineMode) {
        try {
          const res = await fetch("/api/gemini/analyze", {
            method: "POST"
          });
          const text = await res.text();
          const data = JSON.parse(text);
          if (data.success) {
            setAiReport(data.report);
            setFetchingReport(false);
            return;
          } else {
            setAiReport("Lỗi phân tích: " + data.error);
          }
        } catch (apiErr) {
          console.warn("Phân tích AI qua API thất bại, chạy local report fallback", apiErr);
          setIsOfflineMode(true);
        }
      }

      // Local report fallback
      const ldb = getLocalDB();
      const students = ldb.users.filter((u: any) => u.role === "Student");
      const logs = ldb.attendanceLogs;
      const asms = ldb.assignments;
      const subs = ldb.submissions;
      
      setTimeout(() => {
        const generatedReport = `### 📊 BÁO CÁO PHÂN TÍCH CHUYÊN CẦN QUẢN LÝ (Bản Offline Thông minh của Client)
Kính gửi **Thầy Nguyễn Trọng Nghĩa**, trợ lý AI cung cấp báo cáo thống kê chuyên cần lớp học trực tuyến trên trình duyệt (Offline Mode):

#### 1. Thống kê nhanh toàn lớp học
- **Tổng số sinh viên:** ${students.length} học viên đăng ký offline.
- **Tổng số phiên điểm danh đã mở:** ${ldb.attendanceSessions.length} phiên.
- **Tổng số lượt chuyên cần ghi nhận:** ${logs.length} lượt thành công.

#### 2. Nhật ký & Trạng thái hoạt động
- **Nhiệm vụ bài tập:** Hiện có **${asms.length}** bài tập được lưu cục bộ.
- **Dữ liệu minh chứng nộp:** Đã nhận **${subs.length}** tệp PDF hoặc ảnh nén hoàn thành tuyệt vời.

#### 3. Khuyên nghị Sư phạm:
- Giảng viên tiếp tục duy trì phương pháp điểm danh bằng mã PIN ngẫu nhiên giúp kích thích tinh thần đi học đúng giờ.
- Các sinh viên thực hành nộp bài trực xạ giúp bài học được củng cố ngay tại lớp.
`;
        setAiReport(generatedReport);
        setFetchingReport(false);
      }, 1000);
    } catch (err: any) {
      setAiReport("Không thể phân tích: " + err.message + ". Vui lòng thiết lập GEMINI_API_KEY ở cài đặt.");
      setFetchingReport(false);
    }
  };

  // 6. Gửi câu hỏi cho Gemini Chatbot
  const handleChatImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Hình ảnh không được vượt quá 5MB!");
        return;
      }
      setChatImageFilename(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setChatImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() && !chatImage) return;

    setChatLoading(true);
    const textMsg = inputMessage;
    const base64Img = chatImage;
    const filenameImg = chatImageFilename;

    // Reset ngay lập tức để trải nghiệm mượt mà
    setInputMessage("");
    setChatImage(null);
    setChatImageFilename("");

    const sender = currentUser || { id: "GUEST", name: "Khách viếng thăm", role: "Student" };

    try {
      if (!isOfflineMode) {
        try {
          const res = await fetch("/api/chat/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              senderId: sender.id,
              senderName: sender.name,
              senderRole: sender.role,
              content: textMsg,
              fileName: filenameImg,
              fileData: base64Img
            })
          });
          const data = await res.json();
          if (data.success) {
            setChatMessages(prev => {
              const exists = prev.some(m => m.id === data.message.id);
              if (exists) return prev;
              return [...prev, data.message];
            });
            setChatLoading(false);
            // Đồng bộ lại sau 1.5s để cập nhật phản hồi của AI Bot nếu có tag
            setTimeout(() => {
              fetchDataSilent();
            }, 1500);
            return;
          }
        } catch (apiErr) {
          console.warn("Gửi trực tuyến thất bại, dùng cơ chế offline", apiErr);
          setIsOfflineMode(true);
        }
      }

      // Luồng Offline
      const now = new Date();
      const localMsg: ChatMessage = {
        id: "MSG_OFFLINE_" + now.getTime().toString(),
        senderId: sender.id.toUpperCase(),
        senderName: sender.name,
        senderRole: sender.role === "Teacher" ? "Teacher" : "Student",
        content: textMsg,
        time: now.toISOString(),
        imageUrl: base64Img || undefined
      };

      setChatMessages(prev => [...prev, localMsg]);
      setChatLoading(false);

      // Phản hồi giả lập thông minh offline
      const upperCheck = textMsg.toUpperCase();
      if (upperCheck.includes("@BOT") || upperCheck.includes("@AI") || upperCheck.includes("@TRỢ LÝ") || upperCheck.includes("TRỢ LÝ AI")) {
        setChatLoading(true);
        setTimeout(() => {
          const activeSessions = db.attendanceSessions.filter((s: any) => s.isActive);
          let botReply = `Chào em ${sender.name}! Hiện tại tớ đang hoạt động ở chế độ Offline. `;
          if (activeSessions.length > 0) {
            botReply += `Hệ thống ghi nhận phiên điểm danh đang mở lớp **${activeSessions[0].className}** có mã hoạt động là: **${activeSessions[0].code}**. Hãy điểm danh ngay nhé!`;
          } else {
            botReply += `Hệ thống ghi nhận lớp chưa mở phiên điểm danh nào. Hãy chờ giáo viên mở phiên nhé!`;
          }
          
          setChatMessages(prev => [...prev, {
            id: "MSG_AI_OFFLINE_" + Date.now().toString(),
            senderId: "BOT_ASSISTANT",
            senderName: "Trợ lý AI (Bot Offline)",
            senderRole: "Teacher",
            content: botReply,
            time: new Date().toISOString()
          }]);
          setChatLoading(false);
        }, 1200);
      }
    } catch (err: any) {
      console.error("Lỗi gửi tin nhắn:", err);
      setChatLoading(false);
    }
  };

  const handleClearChatHistory = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa sạch toàn bộ lịch sử nhóm chat lớp không?")) return;
    try {
      if (!isOfflineMode) {
        const res = await fetch("/api/chat/clean", { method: "POST" });
        const data = await res.json();
        if (data.success && data.chatMessages) {
          setChatMessages(data.chatMessages);
          return;
        }
      }
    } catch (err) {
      console.warn("Xóa trực tuyến lỗi, xóa offline.");
    }

    const resetMsg: ChatMessage[] = [
      {
        id: "MSG_INIT_1",
        senderId: "ADMIN",
        senderName: "Thầy Nguyễn Trọng Nghĩa",
        senderRole: "Teacher",
        content: "Chào mừng cả lớp đến với nhóm chat chung! Nơi các em có thể hỏi bài học, trao đổi học thuật, và gửi trực tiếp hình ảnh bài tập/góp ý cho Thầy hoặc các bạn nhé. Chúc các em học tập vui vẻ! 🎯📚",
        time: new Date().toISOString()
      }
    ];
    setChatMessages(resetMsg);
  };

  // Gợi ý câu hỏi Chat nhanh
  const quickQuestionsByRole = {
    Teacher: [
      "Tổng quan có bạn nào vắng học nhiều cần cảnh báo không AI?",
      "Cần những trường nào trong bảng Users và Submissions?",
      "Cách cài đặt trigger tự sinh báo cáo trên Google Sheets?"
    ],
    Student: [
      "Mã PIN điểm danh hôm nay là bao nhiêu vậy ạ?",
      "Em có bài tập nào chưa nộp không?",
      "Làm sao để lấy đường dẫn nộp bài Google Drive?"
    ]
  };

  // Các biến đếm tính toán để làm Thống kê Bento sống động
  const totalStudentsCount = db.users.filter(u => u.role === "Student").length;
  const activeSessionsCount = db.attendanceSessions.filter(s => s.isActive).length;
  const submissionToDriveCount = db.submissions.length;
  
  // Tính số lượng SV vắng hoặc có nguy cơ (Điểm danh < totalSessions và có SV nghỉ >= 1 buổi)
  // Trong mockdata, SV005 nghỉ 2/2 phiên, SV003, SV004 nghỉ 1/2 phiên.
  const warningCount = db.users.filter(u => {
    if (u.role !== "Student") return false;
    const studentLogsCount = db.attendanceLogs.filter(l => l.studentId === u.id).length;
    return studentLogsCount < db.attendanceSessions.length;
  }).length;

  if (!currentUser) {
    return (
      <div className="flex min-h-screen w-screen items-center justify-center bg-slate-900 font-sans p-4" id="login-container">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/60 shadow-xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-slate-950 p-8 text-white text-center space-y-2 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-600 rounded-full blur-3xl opacity-30"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500 rounded-full blur-3xl opacity-20"></div>
            
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center font-bold text-white text-lg shadow mx-auto mb-3">
              NTN
            </div>
            <h2 className="text-xl font-bold font-sans tracking-tight">ĐIỂM DANH LỚP THUDK3-2026</h2>
            <p className="text-[11px] text-slate-400 font-mono uppercase tracking-wider">Hệ thống Điểm danh & Quản lý bài tập</p>
          </div>

          {!isRegistering ? (
            <>
              {/* Tab Selector */}
              <div className="grid grid-cols-2 border-b border-slate-100 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginRole("Student");
                    setLoginId("");
                    setLoginPassword("");
                    setLoginError("");
                  }}
                  className={`py-3 text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    loginRole === "Student" 
                      ? "bg-white text-indigo-600 shadow-sm border border-slate-200" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <User className="w-4 h-4" />
                  Sinh viên
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginRole("Teacher");
                    setLoginId("");
                    setLoginPassword("");
                    setLoginError("");
                  }}
                  className={`py-3 text-xs font-bold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    loginRole === "Teacher" 
                      ? "bg-white text-indigo-600 shadow-sm border border-slate-200" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Giảng viên
                </button>
              </div>

              <form onSubmit={handleLoginSubmit} className="p-6 md:p-8 space-y-5">
                {loginError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-medium flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Mã tài khoản (ID)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-slate-400">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        value={loginId}
                        onChange={(e) => setLoginId(e.target.value)}
                        placeholder={loginRole === "Student" ? "Nhập mã SV (Ví dụ: SV001)" : "Nhập mã GV (Ví dụ: GV001)"}
                        className="w-full text-xs font-sans bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Mật khẩu tài khoản
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-slate-400">
                        <BookOpen className="w-4 h-4" />
                      </span>
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Nhập mật khẩu của bạn"
                        className="w-full text-xs font-sans bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loginLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Đang xác thực...
                    </>
                  ) : (
                    "Đăng nhập hệ thống"
                  )}
                </button>

                {loginRole === "Student" && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegistering(true);
                        setRegError("");
                      }}
                      className="text-indigo-600 text-xs font-bold hover:underline cursor-pointer"
                    >
                      Em chưa có tài khoản? Đăng ký ngay tự do
                    </button>
                  </div>
                )}
              </form>
            </>
          ) : (
            /* Student registration form */
            <form onSubmit={handleRegisterSubmit} className="p-6 md:p-8 space-y-5">
              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold text-slate-800">Đăng ký Tài khoản Sinh viên</h3>
                <p className="text-slate-400 text-xs">Điền đầy đủ thông tin để tham gia lớp sinh học tập thực tế</p>
              </div>

              {regError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-medium">
                  {regError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Mã sinh viên của em (Viết liền, không dấu)
                  </label>
                  <input
                    type="text"
                    required
                    value={regId}
                    onChange={(e) => setRegId(e.target.value)}
                    placeholder="Ví dụ: SV123, 2210041,..."
                    className="w-full text-xs font-sans bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Họ và Tên
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn Hải"
                    className="w-full text-xs font-sans bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Tên Lớp (Mã lớp do Giảng viên cung cấp)
                  </label>
                  <input
                    type="text"
                    required
                    value={regClassName}
                    onChange={(e) => setRegClassName(e.target.value)}
                    placeholder="Ví dụ: IT-K15, SP-K16, NTN-PRO..."
                    className="w-full text-xs font-sans bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Mật khẩu cá nhân
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Nhập mật khẩu học sinh"
                    className="w-full text-xs font-sans bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow"
                >
                  Hoàn tất Đăng ký tuyển sinh
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="w-full py-2.5 text-slate-500 hover:text-slate-800 text-xs font-medium"
                >
                  Quay lại Đăng nhập
                </button>
              </div>
            </form>
          )}

          {/* Footer branding */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
              Môn học Tin Học Ứng Dụng Khóa 3 © 2026. <br />
              Thiết kế cấu trúc bởi <b>Thầy Nguyễn Trọng Nghĩa</b>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#F8FAFC] font-sans overflow-hidden border border-gray-200">
      
      {/* LỚP PHỦ BACKDROP khí mở Sidebar trên Mobile/iPad */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 z-40 lg:hidden backdrop-blur-xs transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR bên trái - Màu đậm #0F172A - Hỗ trợ kéo trượt đa giao diện */}
      <aside 
        className={`fixed inset-y-0 left-0 lg:relative lg:translate-x-0 w-64 bg-[#0F172A] flex flex-col shrink-0 border-r border-slate-800 transition-transform duration-300 ease-in-out z-50 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`} 
        id="main-sidebar"
      >
        {/* Logo */}
        <div className="p-6 border-b border-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-md shadow-indigo-900/30 font-sans">
              NTN
            </div>
            <div>
              <h1 className="text-white font-bold text-sm tracking-tight leading-none">Smart Attendance</h1>
              <p className="text-slate-500 font-medium text-[10px] mt-1 font-mono">INTEGRATED AI v1.2</p>
            </div>
          </div>

          {/* Nút ẩn sidebar trên Mobile/iPad */}
          <button 
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700/60 transition-all cursor-pointer"
            title="Đóng menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thông tin tài khoản đăng nhập */}
        <div className="px-4 py-4 border-b border-slate-800/60" id="user-profile-section">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-2 mb-2 font-mono">Tài khoản hiện tại</p>
          <div className="bg-slate-900 rounded-xl p-3 border border-slate-800/80 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 uppercase font-sans">
                {currentUser?.name ? currentUser.name.charAt(0) : "U"}
              </div>
              <div className="overflow-hidden">
                <p className="text-white text-xs font-bold truncate font-sans">{currentUser?.name}</p>
                <p className="text-slate-400 text-[9px] font-mono leading-none mt-0.5">{currentUser?.id} • {currentUser?.role === "Teacher" ? "Giảng viên" : `Lớp ${currentUser?.className || "K15"}`}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsSidebarOpen(false);
                handleLogout();
              }}
              className="w-full py-1.5 bg-rose-950/40 hover:bg-rose-900 border border-rose-900/30 hover:border-rose-900 text-[10px] text-rose-400 font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 font-sans"
            >
              Đăng xuất
            </button>
          </div>
        </div>

        {/* Các nút menu danh mục chuyển tab - Auto ẩn khi nhấp trên Mobile */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {currentRole === "Teacher" && (
            <button 
              onClick={() => {
                setActiveTab("overview");
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeTab === "overview" 
                ? "bg-indigo-600/10 text-indigo-400 border-l-4 border-indigo-500 font-semibold" 
                : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span className="flex items-center gap-3">
                <Users className="w-4 h-4 opacity-80" />
                Tổng quan quản lý
              </span>
              <ChevronRight className="w-3 h-3 opacity-40" />
            </button>
          )}

          <button 
            onClick={() => {
              setActiveTab("attendance");
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === "attendance" 
              ? "bg-indigo-600/10 text-indigo-400 border-l-4 border-indigo-500 font-semibold" 
              : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <span className="flex items-center gap-3">
              <CheckCircle className="w-4 h-4 opacity-80" />
              Thực hiện Điểm danh
            </span>
            <ChevronRight className="w-3 h-3 opacity-40" />
          </button>

          <button 
            onClick={() => {
              setActiveTab("assignments");
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === "assignments" 
              ? "bg-indigo-600/10 text-indigo-400 border-l-4 border-indigo-500 font-semibold" 
              : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <span className="flex items-center gap-3">
              <BookOpen className="w-4 h-4 opacity-80" />
              Giao & Nộp Bài tập
            </span>
            <ChevronRight className="w-3 h-3 opacity-40" />
          </button>

          {currentRole === "Teacher" && (
            <button 
              onClick={() => {
                setActiveTab("gas");
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                activeTab === "gas" 
                ? "bg-indigo-600/10 text-indigo-400 border-l-4 border-indigo-500 font-semibold" 
                : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span className="flex items-center gap-3">
                <FolderDown className="w-4 h-4 opacity-80" />
                G-Suite & Apps Script
              </span>
              <ChevronRight className="w-3 h-3 opacity-40" />
            </button>
          )}

          <button 
            onClick={() => {
              setActiveTab("chat");
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === "chat" 
              ? "bg-indigo-600/10 text-indigo-400 border-l-4 border-indigo-500 font-semibold" 
              : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <span className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 opacity-80" />
              Trợ lý Gemini Class
            </span>
            <ChevronRight className="w-3 h-3 opacity-40" />
          </button>
        </nav>

        {/* Thông tin chân trang - Thầy Nguyễn Trọng Nghĩa */}
        <div className="p-4 mt-auto border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center font-bold text-white text-sm shadow">
              NTN
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-xs font-bold truncate">Thầy Nguyễn Trọng Nghĩa</p>
              <p className="text-indigo-400 text-[10px] uppercase font-bold tracking-wider font-mono">System Architect</p>
            </div>
          </div>
        </div>
      </aside>

      {/* KHU VỰC CHÍNH BÊN PHẢI (MAIN CONTENT) */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* HEADER - Tối giản theo layout Clean Minimalism */}
        <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Nút bấm Hamburger Menu cho các thiết bị di động & Tablet */}
            <button 
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer"
              title="Mở menu quản lý"
            >
              <Menu className="w-5 h-5" />
            </button>

            <span className="text-xs md:text-sm font-semibold text-slate-500 flex items-center gap-1.5 font-sans">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="hidden sm:inline">Chủ Nhật, 21 Tháng 6, 2026</span>
              <span className="inline sm:hidden">21/06/2026</span>
            </span>
            <span className="hidden md:inline text-xs text-slate-300 font-sans">|</span>
            <div className="hidden md:flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-full text-indigo-700 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
              Đã đăng nhập: {currentUser?.name} ({currentUser?.role === "Teacher" ? "Giảng viên" : `Sinh viên / ${currentUser?.className}`})
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={fetchData}
              title="Đồng bộ lại database"
              className="p-2 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-100 rounded-xl transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            </button>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] md:text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">Ready</span>
            </div>
          </div>
        </header>

        {/* CONTAINER NỘI DUNG TỪNG TAB */}
        <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto" id="main-content-scroller">
          
          {/* TAB 1: TỔNG QUAN (OVERVIEW) */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-fade-in" id="overview-tab">
              
              {/* Top Bento Cards - Thống kê */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow transition-shadow">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider font-mono">Thành viên lớp học</p>
                  <p className="text-3xl font-extrabold mt-2 text-slate-800 font-sans">{totalStudentsCount} <span className="text-sm font-semibold text-slate-400">Sinh viên</span></p>
                  <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Thuộc các lớp môn học của Thầy
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow transition-shadow">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider font-mono">Phiên học tập active</p>
                  <p className="text-3xl font-extrabold mt-2 text-indigo-600 font-sans">{activeSessionsCount} <span className="text-sm font-semibold text-slate-400">Phiên điểm danh</span></p>
                  <div className="mt-3 text-xs text-indigo-600 flex items-center gap-1.5 font-sans italic font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    Hỗ trợ mã hóa định danh từng Lớp
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow transition-shadow">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider font-mono">Bài tập đã nộp Drive</p>
                  <p className="text-3xl font-extrabold mt-2 text-emerald-600 font-sans">{submissionToDriveCount} / {db.assignments.length * totalStudentsCount}</p>
                  <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5 font-sans">
                    <Upload className="w-3.5 h-3.5 text-emerald-500" />
                    Đồng bộ Google Drive của Thầy Nghĩa
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow transition-shadow">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider font-mono">Sinh viên cần chú ý</p>
                  <p className="text-3xl font-extrabold mt-2 text-rose-500 font-sans">{warningCount} <span className="text-sm font-semibold text-slate-400">Học viên</span></p>
                  <div className="mt-3 text-xs text-rose-500 flex items-center gap-1.5 font-sans font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Có số buổi vắng thi hoặc trễ hạn
                  </div>
                </div>
              </div>

              {/* BIỂU ĐỒ THỐNG KÊ ĐIỂM DANH SINH VIÊN */}
              <AttendanceChart
                sessions={db.attendanceSessions}
                logs={db.attendanceLogs}
                students={db.users.filter(u => u.role === "Student")}
              />

              {/* Main Grid: Bảng Logs và Báo cáo AI */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-h-min">
                
                {/* Nhật ký điểm danh trực tuyến bên trái */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden min-h-[400px]">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                      <h2 className="font-bold font-sans text-slate-800 text-sm md:text-base">Nhật ký điểm danh trực tuyến</h2>
                      <p className="text-[11px] text-slate-400">Dữ liệu thời gian thực đồng bộ lên Google Sheets</p>
                    </div>
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-mono font-bold">
                      {db.attendanceLogs.length} Bản ghi
                    </span>
                  </div>
                  
                  <div className="flex-1 overflow-auto max-h-[350px]">
                    {db.attendanceLogs.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        Chưa có bản ghi điểm danh nào trong hệ thống.
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] text-slate-400 uppercase font-bold border-b border-slate-100">
                            <th className="px-5 py-3">Họ tên sinh viên</th>
                            <th className="px-5 py-3">Mã SV</th>
                            <th className="px-5 py-3">Phiên / Lớp</th>
                            <th className="px-5 py-3">Thời điểm</th>
                            <th className="px-5 py-4">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs divide-y divide-slate-100">
                          {db.attendanceLogs.map((log) => {
                            const student = db.users.find(u => u.id === log.studentId);
                            const session = db.attendanceSessions.find(s => s.id === log.sessionId);
                            
                            return (
                              <tr key={log.id} className="hover:bg-slate-50/70 transition-all">
                                <td className="px-5 py-3.5 font-bold font-sans text-slate-800">
                                  {student ? student.name : "Sinh viên ẩn danh"}
                                </td>
                                <td className="px-5 py-3.5 text-slate-500 font-mono">
                                  {log.studentId}
                                </td>
                                <td className="px-5 py-3.5">
                                  <div className="font-mono text-slate-600 font-semibold">{log.sessionId}</div>
                                  <div className="text-[10px] text-slate-400">Lớp: {session?.className || "IT-K15"}</div>
                                </td>
                                <td className="px-5 py-3.5">
                                  <div className="font-sans text-slate-600 font-bold">
                                    {new Date(log.time).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </div>
                                  <div className="text-[9px] text-slate-400">
                                    {new Date(log.time).toLocaleDateString("vi-VN")}
                                  </div>
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-extrabold uppercase font-sans border tracking-wide ${
                                    log.status === "Hợp lệ" 
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                                    : log.status === "Muộn" 
                                      ? "bg-amber-50 text-amber-600 border-amber-100" 
                                      : "bg-rose-50 text-rose-600 border-rose-100"
                                  }`}>
                                    {log.status}
                                  </span>
                                  <span></span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Khối phân tích AI chuyên cần bên phải */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden min-h-[400px]">
                  <div className="p-5 border-b border-indigo-50 bg-indigo-50/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
                      <h2 className="font-bold text-slate-800 text-sm md:text-base">Gemini AI Insights</h2>
                    </div>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-[10px] font-extrabold uppercase">
                      Core AI
                    </span>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div className="space-y-4 overflow-y-auto max-h-[300px] flex-1 pr-1">
                      {aiReport ? (
                        <div className="prose prose-xs text-slate-600 font-sans space-y-3 leading-relaxed">
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl relative">
                            <span className="text-slate-400 text-[10px] absolute right-3 top-2 font-mono">BÁO CÁO PHÂN TÍCH</span>
                            <div className="whitespace-pre-line text-xs">
                              {aiReport}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-400 space-y-3">
                          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <Sparkles className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-700">Chưa tạo báo cáo phân tích</p>
                            <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1">
                              Bấm nút bên dưới để Gemini quét toàn bộ AttendanceLogs, Submissions để tìm ra xu hướng học tập và sinh viên vắng nhiều.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <button 
                        onClick={handleRequestAIReport}
                        disabled={fetchingReport}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold font-sans transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {fetchingReport ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            AI đang đọc dữ liệu Sheets phân tích...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Yêu cầu AI xuất báo cáo tổng hợp
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Danh sách bài nộp minh chứng */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 className="font-bold text-slate-705 text-sm md:text-base border-b border-slate-50 pb-3 flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-600" />
                  Hồ sơ bài tập thu được từ Google Drive
                </h3>
                <div className="mt-4 overflow-x-auto">
                  {db.submissions.length === 0 ? (
                    <p className="text-center py-6 text-xs text-slate-400">Chưa có bài nộp nào lên Drive.</p>
                  ) : (
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead>
                        <tr className="bg-slate-50 font-bold border-b border-slate-100">
                          <th className="px-4 py-2">Mã Bài</th>
                          <th className="px-4 py-2">Mã Sinh viên</th>
                          <th className="px-4 py-2">Họ & Tên</th>
                          <th className="px-4 py-2">Tên Tệp Minh Chứng</th>
                          <th className="px-4 py-2">Thời gian nộp</th>
                          <th className="px-4 py-2">Đường dẫn Google Drive thực tế</th>
                        </tr>
                      </thead>
                      <tbody>
                        {db.submissions.map((sub) => {
                          const student = db.users.find(u => u.id === sub.studentId);
                          return (
                            <tr key={sub.id} className="border-b border-slate-50 hover:bg-slate-50">
                              <td className="px-4 py-3 font-mono font-bold text-slate-800">{sub.assignmentId}</td>
                              <td className="px-4 py-3 font-mono">{sub.studentId}</td>
                              <td className="px-4 py-3 font-extrabold text-slate-700">{student?.name || "SVẨn Danh"}</td>
                              <td className="px-4 py-3 italic text-indigo-600 font-medium">{sub.fileName}</td>
                              <td className="px-4 py-3 text-slate-500">{new Date(sub.time).toLocaleString("vi-VN")}</td>
                              <td className="px-4 py-3">
                                <button 
                                  onClick={() => setPreviewSubmission(sub)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold rounded-lg hover:underline transition-all text-[11px] cursor-pointer"
                                >
                                  <FileCheck className="w-3.5 h-3.5" />
                                  Xem & Tải File
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* KHỐI BIỂU DÂN DỤNG: QUẢN LÝ SINH VIÊN (DÀNH CHO GIÁO VIÊN / ADMIN TỔ CHỨC) */}
              {currentRole === "Teacher" && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-600" />
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm md:text-base">Quản lý Danh sách Sinh viên & Cấp tài khoản</h3>
                        <p className="text-[11px] text-slate-400">Giảng viên chủ động thêm, tuyển sinh hoặc xóa học viên khỏi lớp học thực tế</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-150 rounded-lg text-xs font-bold text-indigo-700">
                      Sĩ số: {totalStudentsCount} học viên
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form thêm nhanh sinh viên */}
                    <form onSubmit={handleAddStudentSubmit} className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-150">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">Tuyển sinh sinh viên mới</p>
                      
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Mã sinh viên (ID)</label>
                        <input
                          type="text"
                          required
                          value={addStudentId}
                          onChange={(e) => setAddStudentId(e.target.value)}
                          placeholder="Ví dụ: SV22001, 102241,..."
                          className="w-full text-xs bg-white border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Họ và Tên</label>
                        <input
                          type="text"
                          required
                          value={addStudentName}
                          onChange={(e) => setAddStudentName(e.target.value)}
                          placeholder="Ví dụ: Trịnh Quốc Bảo"
                          className="w-full text-xs bg-white border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Mã Lớp học</label>
                          <input
                            type="text"
                            required
                            value={addStudentClass}
                            onChange={(e) => setAddStudentClass(e.target.value)}
                            placeholder="Ví dụ: IT-K15"
                            className="w-full text-xs bg-white border border-slate-200 rounded-xl py-2 px-3 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Mật khẩu cấp</label>
                          <input
                            type="text"
                            required
                            value={addStudentPassword}
                            onChange={(e) => setAddStudentPassword(e.target.value)}
                            className="w-full text-xs bg-white border border-slate-200 rounded-xl py-2 px-3 focus:outline-none font-mono text-center font-bold"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center justify-center gap-1 cursor-pointer font-sans"
                      >
                        <Plus className="w-4 h-4" /> Thêm học viên mới
                      </button>
                    </form>

                    {/* Danh sách sinh viên đang quản lý */}
                    <div className="lg:col-span-2 space-y-3">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">Danh sách sinh viên hiện hữu</p>
                      
                      <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-[340px] overflow-y-auto">
                        {db.users.filter(u => u.role === "Student").length === 0 ? (
                          <div className="p-10 text-center text-slate-400">
                            Chưa có sinh viên nào trong lớp học. Mời thầy tạo tài khoản hoặc hướng dẫn học sinh đăng ký tự do từ ngoài màn hình đăng nhập.
                          </div>
                        ) : (
                          <table className="w-full text-xs text-left text-slate-600">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 text-[10px] uppercase">
                                <th className="px-4 py-2.5">Mã SV</th>
                                <th className="px-4 py-2.5">Họ & Tên</th>
                                <th className="px-4 py-2.5">Lớp học</th>
                                <th className="px-4 py-2.5">Mật khẩu</th>
                                <th className="px-4 py-2.5 text-right">Thao tác</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {db.users.filter(u => u.role === "Student").map((s) => (
                                <tr key={s.id} className="hover:bg-slate-50 transition-all">
                                  <td className="px-4 py-2.5 font-mono font-bold text-slate-800">{s.id}</td>
                                  <td className="px-4 py-2.5 font-bold text-slate-700">{s.name}</td>
                                  <td className="px-4 py-2.5">
                                    <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded text-[9.5px] font-bold">
                                      {s.className}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 font-mono text-slate-450">{s.password || "123456"}</td>
                                  <td className="px-4 py-2.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteStudent(s.id, s.name)}
                                      className="p-1.5 bg-rose-55 hover:bg-rose-100 text-rose-600 rounded-lg transition-all cursor-pointer"
                                      title="Xóa tài khoản khỏi danh sách"
                                    >
                                      Xóa
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: ĐIỂM DANH */}
          {activeTab === "attendance" && (
            <div className="space-y-6 animate-fade-in" id="attendance-tab">
              <div className={`grid grid-cols-1 ${currentRole === "Teacher" ? "lg:grid-cols-2" : "max-w-2xl mx-auto"} gap-8`}>
                
                {/* PHẦN SINH VIÊN ĐIỂM DANH */}
                <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm space-y-6">
                  <div>
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-extrabold uppercase font-mono tracking-wider">
                      Student Desk
                    </span>
                    <h3 className="text-xl font-bold font-sans text-slate-800 mt-2 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-indigo-600" />
                      Điểm danh Nhập mã PIN lớp học
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Sinh viên điền mã PIN gồm 6 chữ số do Thầy Nguyễn Trọng Nghĩa hiển thị trên bảng lớp học để xác nhận tham dự.
                    </p>
                  </div>

                  <form onSubmit={handleSubmitAttendance} className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                      <div>
                        {currentRole === "Student" ? (
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Sinh viên hiện tại</label>
                            <div className="w-full text-xs font-bold bg-white text-indigo-700 border border-slate-200 rounded-xl py-2.5 px-3 font-mono">
                              {currentUser?.name} - Mã SV: {selectedStudentId} (Lớp {currentUser?.className})
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Tài khoản Sinh viên Điển hình</label>
                            <select 
                              value={selectedStudentId}
                              onChange={(e) => {
                                setSelectedStudentId(e.target.value);
                                setAttendanceMessage(null);
                              }}
                              className="w-full text-xs font-medium bg-white text-slate-800 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500 font-sans font-mono"
                            >
                              <option value="">-- Chọn sinh viên để thực hiện điểm danh --</option>
                              {db.users.filter(u => u.role === "Student").map(s => (
                                <option key={s.id} value={s.id}>{s.name} - Mã SV: {s.id} (Lớp {s.className})</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1 text-center">Nội dung mã PIN Điểm danh (6 chữ số)</label>
                      <input 
                        type="text" 
                        value={pinCode}
                        onChange={(e) => setPinCode(e.target.value)}
                        placeholder="Ví dụ: 123456" 
                        maxLength={6}
                        className="w-full text-center text-3xl font-black font-mono tracking-widest text-indigo-600 border-2 border-slate-200 rounded-2xl py-3 focus:outline-none focus:border-indigo-600 focus:bg-indigo-50/20"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold font-sans transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer font-sans"
                    >
                      Xác nhận Điểm danh
                    </button>
                  </form>

                  {attendanceMessage && (
                    <div className={`p-4 rounded-2xl border text-xs font-sans ${
                      attendanceMessage.type === "success" 
                      ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
                      : "bg-rose-50 text-rose-800 border-rose-100"
                    }`}>
                      <div className="flex gap-2">
                        {attendanceMessage.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />}
                        <span>{attendanceMessage.text}</span>
                      </div>
                    </div>
                  )}

                  {/* Danh sách phiên hiện tại */}
                  <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-mono">Phiên nhận dạng lớp bạn</h4>
                    {db.attendanceSessions.length === 0 ? (
                      <p className="text-xs text-slate-400">Không tìm thấy bất kỳ phiên lịch học nào.</p>
                    ) : (
                      <div className="space-y-2">
                        {db.attendanceSessions.slice(0, 2).map((s) => (
                          <div key={s.id} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-slate-800">Phiên: {s.id} (Lớp: {s.className})</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">Đặt mã PIN để đối soát</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${s.isActive ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-100 text-slate-500"}`}>
                              {s.isActive ? "ĐANG MỞ" : "ĐÃ ĐÓNG"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* PHẦN GIẢNG VIÊN CẤP PHIÊN */}
                {currentRole === "Teacher" && (
                  <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm space-y-6">
                    <div>
                      <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-[10px] font-extrabold uppercase font-mono tracking-wider">
                        Teacher Desk
                      </span>
                      <h3 className="text-xl font-bold font-sans text-slate-800 mt-2 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-amber-500" />
                        Kích hoạt Phiên điểm danh học tập mới
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Giảng viên tạo mã 6 số ngẫu nhiên cho lớp và cấu hình thời gian hiệu lực. Toàn bộ các phiên trước của lớp đó sẽ lập tức chuyển sang trạng thái Đóng (Closed).
                      </p>
                    </div>

                    <form onSubmit={handleCreateSession} className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Mã Lớp học tập nhận diện</label>
                        <input 
                          type="text" 
                          value={newSessionClass}
                          onChange={(e) => setNewSessionClass(e.target.value)}
                          placeholder="Ví dụ: IT-K15"
                          required
                          className="w-full text-xs font-sans bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Thời lượng hiệu lực (Phút)</label>
                          <select
                            value={newSessionMinutes}
                            onChange={(e) => setNewSessionMinutes(Number(e.target.value))}
                            className="w-full text-xs font-sans bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 focus:outline-none focus:border-amber-500"
                          >
                            <option value={15}>15 phút</option>
                            <option value={30}>30 phút</option>
                            <option value={45}>45 phút</option>
                            <option value={60}>60 phút</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Mã PIN Code (Lớp trưởng ghi tạc)</label>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={newSessionCode}
                              onChange={(e) => setNewSessionCode(e.target.value)}
                              maxLength={6}
                              placeholder="Mã 6 chữ số"
                              required
                              className="flex-1 text-center font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={generateRandomPin}
                              className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all text-xs"
                              title="Tạo mã pin ngẫu nhiên"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <button 
                        type="submit"
                        disabled={currentRole !== "Teacher"}
                        className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-bold font-sans transition-all shadow-md shadow-amber-500/10 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        {currentRole !== "Teacher" ? "Chỉ Giảng viên mới được mở phiên" : "Mở phiên Điểm danh và Reset phiên cũ"}
                      </button>
                      {currentRole !== "Teacher" && (
                        <p className="text-[10px] text-amber-600 text-center font-medium font-sans italic">Vui lòng chuyển vai trò sang Giảng viên ở sidebar để thực hành.</p>
                      )}
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: GIAO & NỘP BÀI TẬP */}
          {activeTab === "assignments" && (
            <div className="space-y-6 animate-fade-in" id="assignments-tab">
              <div className={`grid grid-cols-1 ${currentRole === "Teacher" ? "lg:grid-cols-2" : "max-w-2xl mx-auto"} gap-8`}>
                
                {/* SINH VIÊN CHỌN BÀI NỘP VÀO DRIVE */}
                <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm space-y-6">
                  <div>
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-extrabold uppercase font-mono tracking-wider">
                      Student Desk
                    </span>
                    <h3 className="text-xl font-bold font-sans text-slate-800 mt-2 flex items-center gap-2">
                      <Upload className="w-5 h-5 text-indigo-600" />
                      Nộp bài trực tiếp vào Google Drive & Ghi Sổ Sheets
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Chọn file tài liệu nộp minh chứng (PDF, DOCX, ZIP...). Hệ thống sẽ lưu file thật vào thư mục Google Drive của thầy cô và gửi URL chia sẻ quyền xem về Google Sheets.
                    </p>
                  </div>

                  <form onSubmit={handleFileSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div>
                        {currentRole === "Student" ? (
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Mã sinh viên nộp bài</label>
                            <div className="w-full text-xs font-bold bg-white text-indigo-700 border border-slate-200 rounded-xl py-2.5 px-3 font-mono">
                              {currentUser?.name} - Mã SV: {selectedStudentId}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Mã sinh viên nộp bài (Giả lập)</label>
                            <select 
                              value={selectedStudentId}
                              onChange={(e) => setSelectedStudentId(e.target.value)}
                              className="w-full text-xs font-medium bg-white text-slate-800 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none"
                            >
                              {db.users.filter(u => u.role === "Student").map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Chọn nhiệm vụ Bài Tập</label>
                        <select 
                          value={selectedAsmId}
                          onChange={(e) => setSelectedAsmId(e.target.value)}
                          className="w-full text-xs font-medium bg-white text-slate-800 border border-slate-200 rounded-xl py-2 px-3 focus:outline-none"
                        >
                          {db.assignments.map(a => (
                            <option key={a.id} value={a.id}>{a.id} - {a.title}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Vùng kéo thả file */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Tệp bài làm đính kèm</label>
                      <div className="border-2 border-dashed border-slate-200 hover:border-indigo-500 bg-slate-50 hover:bg-slate-100/50 rounded-2xl p-6 text-center transition-all relative">
                        <input 
                          type="file" 
                          id="file-upload-input"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setStudentSubmissionFile(e.target.files[0]);
                              setFileSubmitMessage(null);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        {studentSubmissionFile ? (
                          <div>
                            <p className="text-xs font-bold text-slate-800 truncate">{studentSubmissionFile.name}</p>
                            <p className="text-[10px] text-emerald-600 font-mono mt-1">Dung lượng: {(studentSubmissionFile.size / 1024).toFixed(1)} KB - Nhấp để thay thế</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs font-bold text-slate-600">Bấm hoặc kéo thả tệp của em vào đây</p>
                            <p className="text-[10px] text-slate-400 mt-1">Chấp nhận mọi định dạng: .pdf, .docx, .zip, .png...</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={isSubmittingFile}
                      className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-2xl text-xs font-bold font-sans transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmittingFile ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Đang upload tệp Base64 lên Drive...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Thực hiện nộp bài lên Drive
                        </>
                      )}
                    </button>
                  </form>

                  {fileSubmitMessage && (
                    <div className={`p-4 rounded-2xl border text-xs font-sans ${
                      fileSubmitMessage.type === "success" 
                      ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
                      : "bg-rose-50 text-rose-800 border-rose-100"
                    }`}>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          {fileSubmitMessage.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                          <span>{fileSubmitMessage.text}</span>
                        </div>
                        {fileSubmitMessage.link && (
                          <a 
                            href={fileSubmitMessage.link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 font-extrabold hover:underline mt-1 font-sans"
                          >
                            Xem thư mục file ảo của bạn tương hợp trên Google Drive &rarr;
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* GIẢNG VIÊN GIAO BÀI TẬP MỚI */}
                {currentRole === "Teacher" && (
                  <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm space-y-6">
                    <div>
                      <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-[10px] font-extrabold uppercase font-mono tracking-wider">
                        Teacher Desk
                      </span>
                      <h3 className="text-xl font-bold font-sans text-slate-800 mt-2 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-amber-500" />
                        Giao nhiệm vụ Học tập mới (Sheets Database)
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Giảng viên viết tiêu đề, hướng dẫn chi tiết và ngày hết hạn nộp bài. Dữ liệu sẽ chèn mới một dòng vào bảng Assignments.
                      </p>
                    </div>

                    <form onSubmit={handleCreateAssignment} className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Mã nhiệm vụ / Assignment ID (Tùy chọn)</label>
                        <input 
                          type="text" 
                          value={newAsmId}
                          onChange={(e) => setNewAsmId(e.target.value)}
                          placeholder="Ví dụ: ASM101, ASM-LAB3... (Bỏ trống sẽ tự sinh)"
                          className="w-full text-xs font-sans bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 focus:outline-none focus:border-amber-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Tiêu đề Bài Tập</label>
                        <input 
                          type="text" 
                          value={newAsmTitle}
                          onChange={(e) => setNewAsmTitle(e.target.value)}
                          placeholder="Ví dụ: Bài tập 3: Cài đặt và Phân tích"
                          required
                          className="w-full text-xs font-sans bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Yêu cầu nội dung chi tiết</label>
                        <textarea 
                          rows={3}
                          value={newAsmContent}
                          onChange={(e) => setNewAsmContent(e.target.value)}
                          placeholder="Hãy ghi chi tiết yêu cầu các bước cần hoàn tất..."
                          required
                          className="w-full text-xs font-sans bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Hạn chót nộp bài</label>
                        <input 
                          type="datetime-local" 
                          value={newAsmDueDate}
                          onChange={(e) => setNewAsmDueDate(e.target.value)}
                          required
                          className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 focus:outline-none"
                        />
                      </div>

                      <button 
                        type="submit"
                        disabled={currentRole !== "Teacher"}
                        className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-bold font-sans transition-all shadow-md shadow-amber-500/10 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Giao bài tập lên hệ thống
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Danh sách bài tập hiện đang được giao */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6" id="assignments-list-card">
                <h3 className="font-bold text-slate-800 text-sm md:text-base border-b border-slate-50 pb-3 flex items-center gap-2 mb-4">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  Danh sách bài tập Lớp học (Sheets: Assignments Tab)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {db.assignments.map((asm) => {
                    const due = new Date(asm.dueDate);
                    const isOverdue = due.getTime() < new Date().getTime();
                    
                    return (
                      <div key={asm.id} className="p-4 rounded-xl border border-slate-100 hover:border-indigo-300 bg-slate-50/50 hover:bg-white transition-all space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-mono font-bold rounded text-[10px]">
                            {asm.id}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isOverdue ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                            {isOverdue ? "Hết hạn" : "Đang mở"}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 font-sans">{asm.title}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed lines-clamp-2">{asm.content}</p>
                        <div className="pt-2 text-[11px] text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Hạn nộp: <b className={isOverdue ? "text-rose-500" : "text-slate-600"}>{due.toLocaleString("vi-VN")}</b>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: MÃ NGUỒN APPS SCRIPT CHO G-SUITE (GAS) */}
          {activeTab === "gas" && (
            <div className="animate-fade-in" id="apps-script-guide-tab">
              <GoogleAppsScriptCode />
            </div>
          )}

          {/* TAB 5: NHÓM CHAT LỚP THẢO LUẬN & GỬI BÀI TẬP */}
          {activeTab === "chat" && (
            <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden flex flex-col h-[calc(100vh-140px)] min-h-[480px] lg:h-[680px] animate-fade-in" id="class-group-chat-tab">
              
              {/* Tiêu đề Box Chat - Nhóm Chat Lớp */}
              <div className="bg-gradient-to-r from-indigo-900 to-indigo-850 text-white px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-indigo-950/20">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600/90 border border-white/20 flex items-center justify-center font-bold text-lg shadow-md animate-pulse">
                      <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-indigo-900 rounded-full"></span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm md:text-base leading-none flex items-center gap-2">
                      Nhóm Thảo Luận Lớp & Hỏi Bài 👥
                    </h3>
                    <p className="text-[10px] text-indigo-200 mt-1.5 font-mono">
                      Khóa học Smart Attendance AI • {db.users.length} thành viên trực tuyến
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto">
                  {/* Tìm kiếm tin nhắn */}
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Tìm tin nhắn..."
                      value={chatSearch}
                      onChange={(e) => setChatSearch(e.target.value)}
                      className="w-36 md:w-44 text-[11px] bg-indigo-950/40 border border-indigo-800/60 rounded-xl py-1.5 pl-7 pr-2.5 text-indigo-100 placeholder-indigo-300 focus:outline-none focus:bg-indigo-950/70 focus:border-indigo-500 font-sans"
                    />
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-indigo-300" />
                  </div>

                  <button
                    onClick={() => {
                      fetchDataSilent();
                    }}
                    title="Đồng bộ ngay"
                    className="p-2 bg-indigo-800/40 hover:bg-indigo-800 text-indigo-100 hover:text-white rounded-xl transition-all border border-indigo-800/40 cursor-pointer text-xs flex items-center gap-1 font-sans"
                  >
                    <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                  </button>

                  {currentUser?.role === "Teacher" && (
                    <button
                      onClick={handleClearChatHistory}
                      className="p-2 bg-rose-500/20 hover:bg-rose-600/90 text-rose-300 hover:text-white rounded-xl transition-all border border-rose-500/10 cursor-pointer text-xs"
                      title="Xóa lịch sử tin nhắn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Lịch sử tin nhắn của cả lớp */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/50 flex flex-col">
                {chatMessages.filter(msg => {
                  const q = chatSearch.toLowerCase();
                  return (msg.content || "").toLowerCase().includes(q) || (msg.senderName || "").toLowerCase().includes(q);
                }).map((msg) => {
                  const isMe = msg.senderId.trim().toUpperCase() === (currentUser?.id || "GUEST").trim().toUpperCase();
                  const isTeacher = msg.senderRole === "Teacher" || msg.senderId.trim().toUpperCase() === "ADMIN";
                  const isBot = msg.senderId === "BOT_ASSISTANT";

                  return (
                    <div 
                      key={msg.id} 
                      className={`flex items-start gap-2.5 max-w-[85%] ${
                        isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'
                      }`}
                    >
                      {/* Avatar */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold shadow-sm ${
                        isMe 
                          ? 'bg-indigo-600 text-white' 
                          : isTeacher 
                            ? 'bg-amber-500 text-slate-900 border border-amber-300'
                            : isBot
                              ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                              : 'bg-emerald-600 text-white'
                      }`}>
                        {isMe ? "TÔI" : isBot ? "AI" : msg.senderName.substring(0, 2).toUpperCase()}
                      </div>
                      
                      {/* Khung tin nhắn */}
                      <div className="flex flex-col space-y-1">
                        {/* Tên người gửi & Thời gian */}
                        <div className={`flex items-center gap-1.5 text-[10px] text-slate-400 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <span className={`font-bold ${isTeacher ? 'text-amber-600' : 'text-slate-600'}`}>
                            {msg.senderName}
                          </span>
                          {isTeacher && !isBot && (
                            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-bold scale-90">GV</span>
                          )}
                          {isBot && (
                            <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded font-bold scale-90 flex items-center gap-0.5">
                              🤖 AI
                            </span>
                          )}
                          <span>•</span>
                          <span className="font-mono">
                            {new Date(msg.time).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Văn bản tin nhắn */}
                        <div className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm border border-black/5 ${
                          isMe 
                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                            : isTeacher
                              ? 'bg-amber-50 border-amber-100 text-slate-800 rounded-tl-none font-medium'
                              : isBot
                                ? 'bg-indigo-50/80 border-indigo-100 text-indigo-950 rounded-tl-none font-sans'
                                : 'bg-white text-slate-800 border-slate-100 rounded-tl-none'
                        }`}>
                          <p className="whitespace-pre-line font-sans">{msg.content}</p>
                          
                          {/* Render hình ảnh bài tập/góp ý đính kèm */}
                          {msg.imageUrl && (
                            <div className="mt-2.5 relative group overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-100 max-w-sm">
                              <img 
                                src={msg.imageUrl} 
                                alt="Ảnh đính kèm" 
                                referrerPolicy="no-referrer"
                                className="max-h-48 w-full object-cover rounded-xl cursor-zoom-in group-hover:scale-102 transition-all"
                                onClick={() => setZoomImageUrl(msg.imageUrl || null)}
                              />
                              <div className="absolute inset-0 bg-transparent hover:bg-black/10 transition-colors flex items-center justify-center cursor-pointer pointer-events-none">
                                <Maximize2 className="w-6 h-6 text-white/0 group-hover:text-white/85 drop-shadow transition-all" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {chatLoading && (
                  <div className="flex items-start gap-2.5 max-w-[80%] mr-auto">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-xs">
                      AI
                    </div>
                    <div className="bg-white text-slate-500 border border-slate-100 p-4 rounded-2xl rounded-tl-none text-xs flex items-center gap-2 shadow-sm">
                      <span className="flex gap-1.5">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                      </span>
                      <span className="font-sans text-slate-400">Trợ lý AI lớp đang nhập phản hồi...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Câu hỏi gợi ý nhanh để TAG BOT hỗ trợ */}
              <div className="px-6 py-2.5 bg-slate-100/50 border-t border-slate-100 overflow-x-auto whitespace-nowrap flex items-center gap-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0">Hỏi nhanh AI:</span>
                {[
                  "@bot xem mã pin điểm danh hôm nay",
                  "@bot bài tập lớp đã giao là gì?",
                  "@bot tóm tắt cấu trúc cơ sở dữ liệu trên G-Suite"
                ].map((q, qidx) => (
                  <button
                    key={qidx}
                    onClick={() => {
                      setInputMessage(q);
                    }}
                    className="inline-block px-3 py-1.5 bg-white hover:bg-indigo-50 text-[10px] text-indigo-750 font-sans border border-slate-200 rounded-lg transition-all cursor-pointer shadow-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Form gửi tin nhắn kèm hình ảnh của học viên & thầy */}
              <div className="p-4 bg-white border-t border-slate-100 flex flex-col gap-2">
                {/* Preview ảnh chuẩn bị gửi */}
                {chatImage && (
                  <div className="flex items-center gap-2.5 p-2 bg-indigo-50 border border-indigo-100 rounded-xl max-w-sm animate-fade-in">
                    <img 
                      src={chatImage} 
                      alt="Xem trước ảnh đính kèm" 
                      className="w-12 h-12 object-cover rounded-lg border border-indigo-200 shadow-sm"
                    />
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[10px] text-indigo-900 font-bold truncate">Đính kèm: {chatImageFilename}</p>
                      <p className="text-[9px] text-indigo-400">Ảnh bài tập chuẩn bị gửi</p>
                    </div>
                    <button 
                      onClick={() => {
                        setChatImage(null);
                        setChatImageFilename("");
                      }}
                      className="p-1 px-2.5 rounded-lg bg-indigo-100 hover:bg-rose-100 hover:text-rose-600 text-indigo-700 text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      ✕ Hủy bỏ
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendChatMessage} className="flex gap-2">
                  {/* Nut attach hinh anh */}
                  <label 
                    className={`px-3 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-2xl border border-slate-200 transition-all cursor-pointer flex items-center justify-center shadow-sm relative group`}
                    title="Đính kèm ảnh bài tập/góp ý"
                  >
                    <ImageIcon className="w-5 h-5" />
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleChatImageChange}
                      className="hidden" 
                    />
                  </label>

                  <input 
                    type="text" 
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={chatImage ? `Viết ghi chú/giải thích cho hình ảnh bài tập này...` : `Chào ${currentUser?.name || "bạn"}, hãy nhắn tin hỏi bài, thảo luận hoặc tag @bot để hỏi...`}
                    className="flex-1 text-xs border border-slate-200 rounded-2xl py-3 px-4 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-sans shadow-sm"
                  />
                  
                  <button 
                    type="submit"
                    disabled={(!inputMessage.trim() && !chatImage) || chatLoading}
                    className="px-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-2xl transition-all cursor-pointer flex items-center justify-center shadow-md shadow-indigo-500/10"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>

            </div>
          )}

        </div>
      </main>

      {/* MODAL XEM CHI TIẾT FILE NỘP MINH CHỨNG */}
      {previewSubmission && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="preview-submission-modal">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-150 flex flex-col overflow-hidden max-h-[90vh]">
            <div className="bg-indigo-900 text-white px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-300" />
                <h3 className="font-extrabold text-sm md:text-base">Minh chứng Nộp bài</h3>
              </div>
              <button 
                onClick={() => setPreviewSubmission(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-indigo-200 hover:text-white transition-all text-xs cursor-pointer font-bold"
              >
                Đóng
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <p className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider">Thông tin học viên</p>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="font-extrabold text-slate-800 text-xs">
                    {db.users.find(u => u.id === previewSubmission.studentId)?.name || 'Sinh viên ẩn danh'}
                  </p>
                  <p className="font-mono text-[10px] text-slate-500 mt-0.5">Mã sinh viên: {previewSubmission.studentId}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider">Nhiệm vụ & Bài tập</p>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="font-bold text-slate-800 text-xs">Mã nhiệm vụ: {previewSubmission.assignmentId}</p>
                  <p className="text-[11px] text-indigo-600 font-bold mt-1">Tên file nộp: {previewSubmission.fileName}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Thời gian nhận bài: {new Date(previewSubmission.time).toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider">Tác vụ File</p>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <a 
                    href={previewSubmission.driveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold font-sans transition-all shadow text-center cursor-pointer"
                  >
                    <Upload className="w-4 h-4" /> Xem thư mục Drive
                  </a>
                  
                  {previewSubmission.fileData ? (
                    <a
                      href={previewSubmission.fileData}
                      download={previewSubmission.fileName}
                      className="flex items-center justify-center gap-1.5 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold font-sans transition-all shadow text-center cursor-pointer"
                    >
                      Tải file gốc
                    </a>
                  ) : (
                    <a
                      href={previewSubmission.driveUrl}
                      download={previewSubmission.fileName}
                      target="_blank"
                      className="flex items-center justify-center gap-1.5 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold font-sans transition-all shadow text-center cursor-pointer"
                    >
                      Tải file máy chủ
                    </a>
                  )}
                </div>
              </div>

              {previewSubmission.fileData && previewSubmission.fileData.startsWith("data:image/") && (
                <div className="space-y-2 pt-2 border-t border-slate-150">
                  <p className="text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider">Xem hình ảnh trực quan</p>
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2 flex items-center justify-center max-h-[220px]">
                    <img 
                      src={previewSubmission.fileData} 
                      alt="Minh chứng nộp" 
                      className="max-h-[200px] max-w-full object-contain rounded-lg" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL PHÓNG TO HÌNH ẢNH GRUOP CHAT */}
      {zoomImageUrl && (
        <div 
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-[9900] animate-fade-in cursor-zoom-out"
          onClick={() => setZoomImageUrl(null)}
          id="chat-image-lightbox-modal"
        >
          <div className="relative max-w-4xl max-h-[85vh] flex items-center justify-center">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setZoomImageUrl(null);
              }}
              className="absolute -top-14 right-2 bg-slate-800/80 hover:bg-slate-700 hover:text-white text-slate-300 rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg transition-colors cursor-pointer shadow border border-slate-700"
              title="Đóng xem ảnh"
            >
              ✕
            </button>
            <img 
              src={zoomImageUrl} 
              alt="Hình ảnh đính kèm thảo luận phóng to" 
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-white/15 cursor-default"
              onClick={(e) => {
                e.stopPropagation(); // Ngăn kết thúc khi bấm vào hình
              }}
            />
          </div>
          <p className="text-white/60 text-xs mt-4 font-sans select-none text-center">
            Nhấp vào bất cứ vùng trống nào ở ngoài để đóng phóng to ảnh
          </p>
        </div>
      )}

    </div>
  );
}
