import React, { useState, useEffect } from "react";
import { Check, Copy, Code, FileCode, AppWindow, Database, RefreshCw, FolderGit, Save } from "lucide-react";

export default function GoogleAppsScriptCode() {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [scriptUrl, setScriptUrl] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    // Tải cấu hình Web App URL từ express backend khi component mount
    fetch("/api/config")
      .then(res => res.json())
      .then(data => {
        if (data.googleScriptUrl) {
          setScriptUrl(data.googleScriptUrl);
        }
      })
      .catch(err => console.warn("Lỗi tải cấu hình API Script:", err));
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scriptUrl })
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus({ type: "success", text: "🎉 Đã kết nối và đồng bộ hai chiều thành công với Google Apps Script Web App và Google Sheets!" });
      } else {
        setSaveStatus({ type: "error", text: "Không thể lưu cấu hình mới." });
      }
    } catch (err: any) {
      setSaveStatus({ type: "error", text: "Lỗi kết nối Server: " + err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const codeGs = `/**
 * Hệ thống điểm danh và giao bài tập thông minh lưu trữ G-Suite
 * Người phát triển: Thầy Nguyễn Trọng Nghĩa & Cộng sự
 * File: Code.gs - Code xử lý Backend chạy trên Google Apps Script
 */

// Cấu hình ID của Google Sheet và Thư mục Google Drive lưu bài tập
const SPREADSHEET_ID = "ĐIỀN_ID_GOOGLE_SHEETS_CỦA_BẠN_VÀO_ĐÂY";
const DRIVE_FOLDER_ID = "138c-CG-nB7YuXH4Dv-lvkJaI7s6C_7uD"; // Thư mục lưu trữ chính của hệ thống
const GEMINI_API_KEY = "ĐIỀN_API_KEY_GEMINI_CỦA_BẠN_VÀO_ĐÂY";

/**
 * 1. Khởi tạo toàn bộ các Sheet (Bảng) nếu chưa tồn tại
 */
function setupDatabase() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Tab Users
  if (!ss.getSheetByName("Users")) {
    const sheet = ss.insertSheet("Users");
    sheet.appendRow(["Mã SV/GV", "Họ Tên", "Vai trò", "Mã Lớp", "Mật Khẩu"]);
    sheet.appendRow(["admin", "Thầy Nguyễn Trọng Nghĩa", "Teacher", "ALL", "Nsg@2026"]);
  }
  
  // Tab AttendanceSessions
  if (!ss.getSheetByName("AttendanceSessions")) {
    const sheet = ss.insertSheet("AttendanceSessions");
    sheet.appendRow(["Mã Phiên", "Mã Lớp", "Mã Điểm Danh", "Thời gian bắt đầu", "Thời gian hết hạn", "Ngày", "Trạng thái"]);
  }
  
  // Tab AttendanceLogs
  if (!ss.getSheetByName("AttendanceLogs")) {
    const sheet = ss.insertSheet("AttendanceLogs");
    sheet.appendRow(["Mã Log", "Mã Phiên", "Mã Sinh Viên", "Thời gian bấm", "Trạng thái", "IP", "GPS"]);
  }
  
  // Tab Assignments
  if (!ss.getSheetByName("Assignments")) {
    const sheet = ss.insertSheet("Assignments");
    sheet.appendRow(["Mã Bài Tập", "Tiêu đề", "Nội dung", "Hạn nộp"]);
  }
  
  // Tab Submissions
  if (!ss.getSheetByName("Submissions")) {
    const sheet = ss.insertSheet("Submissions");
    sheet.appendRow(["Mã Nộp Bài", "Mã Bài Tập", "Mã Sinh Viên", "Thời gian nộp", "Drive URL", "File ID"]);
  }

  // Tab ClassChat
  if (!ss.getSheetByName("ClassChat")) {
    const sheet = ss.insertSheet("ClassChat");
    sheet.appendRow(["Mã Tin Nhắn", "Người gửi", "Tên người gửi", "Vai trò", "Nội dung", "Thời gian", "Ảnh URL"]);
  }
  
  Logger.log("Đã cấu trúc và khởi tạo cơ sở dữ liệu trên Google Sheets thành công.");
}

/**
 * 2. Hàm doGet xử lý hiển thị giao diện Frontend (Index.html) khi truy cập trực tiếp Web App
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile("Index");
  return template.evaluate()
    .setTitle("NTN Smart Attendance AI Portal")
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

/**
 * 2b. Hàm doPost tiếp nhận các API request dạng JSON từ Cloud Run / External Server (Node.js)
 */
function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var request = JSON.parse(rawData);
    var action = request.action;
    
    var result = { success: false, error: "Hành động không hợp lệ" };
    
    if (action === "getAllData") {
      result = getAllDataFromSheets();
    } else if (action === "uploadAssignment") {
      result = uploadAssignment(
        request.studentId,
        request.assignmentId,
        request.fileName,
        request.fileData
      );
    } else if (action === "getFileIdBySession") {
      result = getFileIdBySession(request.fileId);
    } else if (action === "submitAttendance") {
      result = submitAttendance(request.studentId, request.code, request.gpsInfo);
    } else if (action === "createAttendanceSession") {
      result = createAttendanceSession(request.className, request.durationMinutes);
    } else if (action === "createUser") {
      result = createUser(request.user);
    } else if (action === "deleteUser") {
      result = deleteUser(request.id);
    } else if (action === "createAssignment") {
      result = createAssignment(request.assignment);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Lỗi Server Apps Script: " + err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Truy xuất toàn bộ dữ liệu từ các tab Google Sheets để đồng bộ trực tiếp với Node.js Server
 */
function getAllDataFromSheets() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // 1. Users
    var userSheet = ss.getSheetByName("Users");
    var users = [];
    if (userSheet) {
      var data = userSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0]) {
          users.push({
            id: data[i][0].toString().toUpperCase(),
            name: data[i][1] ? data[i][1].toString() : "",
            role: data[i][2] ? data[i][2].toString() : "Student",
            className: data[i][3] ? data[i][3].toString() : "",
            password: data[i][4] ? data[i][4].toString() : "123456"
          });
        }
      }
    }
    
    // 2. AttendanceSessions
    var sessSheet = ss.getSheetByName("AttendanceSessions");
    var sessions = [];
    if (sessSheet) {
      var data = sessSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0]) {
          sessions.push({
            id: data[i][0].toString(),
            className: data[i][1] ? data[i][1].toString() : "",
            code: data[i][2] ? data[i][2].toString() : "",
            startTime: data[i][3] ? (typeof data[i][3] === "object" ? data[i][3].toISOString() : data[i][3].toString()) : "",
            durationMinutes: 15,
            date: data[i][5] ? data[i][5].toString() : "",
            isActive: data[i][6] === "Active"
          });
        }
      }
    }
    
    // 3. AttendanceLogs
    var logSheet = ss.getSheetByName("AttendanceLogs");
    var logs = [];
    if (logSheet) {
      var data = logSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0]) {
          logs.push({
            id: data[i][0].toString(),
            sessionId: data[i][1] ? data[i][1].toString() : "",
            studentId: data[i][2] ? data[i][2].toString().toUpperCase() : "",
            time: data[i][3] ? (typeof data[i][3] === "object" ? data[i][3].toISOString() : data[i][3].toString()) : "",
            status: data[i][4] === "Muộn" ? "Muộn" : "Hợp lệ",
            ip: data[i][5] ? data[i][5].toString() : "GAS-Gateway"
          });
        }
      }
    }
    
    // 4. Assignments
    var asmSheet = ss.getSheetByName("Assignments");
    var assignments = [];
    if (asmSheet) {
      var data = asmSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0]) {
          assignments.push({
            id: data[i][0].toString().toUpperCase(),
            title: data[i][1] ? data[i][1].toString() : "",
            content: data[i][2] ? data[i][2].toString() : "",
            dueDate: data[i][3] ? data[i][3].toString() : ""
          });
        }
      }
    }
    
    // 5. Submissions
    var subSheet = ss.getSheetByName("Submissions");
    var submissions = [];
    if (subSheet) {
      var data = subSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0]) {
          submissions.push({
            id: data[i][0].toString(),
            assignmentId: data[i][1] ? data[i][1].toString().toUpperCase() : "",
            studentId: data[i][2] ? data[i][2].toString().toUpperCase() : "",
            time: data[i][3] ? (typeof data[i][3] === "object" ? data[i][3].toISOString() : data[i][3].toString()) : "",
            driveUrl: data[i][4] ? data[i][4].toString() : "",
            fileId: data[i][5] ? data[i][5].toString() : ""
          });
        }
      }
    }

    // 6. ClassChat
    var chatSheet = ss.getSheetByName("ClassChat");
    var chatMessages = [];
    if (chatSheet) {
      var chatData = chatSheet.getDataRange().getValues();
      for (var i = 1; i < chatData.length; i++) {
        if (chatData[i][0]) {
          chatMessages.push({
            id: chatData[i][0].toString(),
            senderId: chatData[i][1] ? chatData[i][1].toString() : "",
            senderName: chatData[i][2] ? chatData[i][2].toString() : "",
            senderRole: chatData[i][3] ? chatData[i][3].toString() : "Student",
            content: chatData[i][4] ? chatData[i][4].toString() : "",
            time: chatData[i][5] ? (typeof chatData[i][5] === "object" ? chatData[i][5].toISOString() : chatData[i][5].toString()) : "",
            imageUrl: chatData[i][6] ? chatData[i][6].toString() : ""
          });
        }
      }
    }
    
    return {
      success: true,
      users: users,
      attendanceSessions: sessions,
      attendanceLogs: logs,
      assignments: assignments,
      submissions: submissions,
      chatMessages: chatMessages
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * 3. Sinh mã điểm danh ngẫu nhiên (6 chữ số) và kích hoạt phiên mới
 */
function createAttendanceSession(className, durationMinutes) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("AttendanceSessions");
    
    // Deactivate các phiên trước của cùng lớp này
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === className && data[i][6] === "Active") {
        sheet.getRange(i + 1, 7).setValue("Closed");
      }
    }
    
    // Tạo mã code 6 số ngẫu nhiên
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = "SESS" + new Date().getTime().toString().substring(6);
    const now = new Date();
    const limitTime = new Date(now.getTime() + durationMinutes * 60 * 1000);
    const dateStr = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
    
    sheet.appendRow([
      sessionId,
      className,
      code,
      now.toISOString(),
      limitTime.toISOString(),
      dateStr,
      "Active"
    ]);
    
    return { success: true, code: code, sessionId: sessionId };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * 4. Học viên gửi mã điểm danh (Nhận dạng IP, GPS)
 */
function submitAttendance(studentId, code, gpsInfo) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Kiểm tra sinh viên có tồn tại trong lớp không
    const userSheet = ss.getSheetByName("Users");
    const users = userSheet.getDataRange().getValues();
    let studentClass = "";
    let studentExist = false;
    for (let i = 1; i < users.length; i++) {
      if (users[i][0].toString().toLowerCase() === studentId.toString().toLowerCase()) {
        studentExist = true;
        studentClass = users[i][3];
        break;
      }
    }
    
    if (!studentExist) {
      return { success: false, message: "Không tìm thấy mã số Sinh viên này trong hệ thống!" };
    }
    
    // Tìm phiên điểm danh Active tương ứng lớp học
    const sessSheet = ss.getSheetByName("AttendanceSessions");
    const sessions = sessSheet.getDataRange().getValues();
    let activeSession = null;
    let sessionRowIndex = -1;
    for (let j = 1; j < sessions.length; j++) {
      if (sessions[j][1] === studentClass && sessions[j][6] === "Active") {
        activeSession = {
          id: sessions[j][0],
          code: sessions[j][2],
          endTime: new Date(sessions[j][4])
        };
        sessionRowIndex = j + 1;
        break;
      }
    }
    
    if (!activeSession) {
      return { success: false, message: "Hiện lớp đang không có phiên điểm danh nào mở!" };
    }
    
    // Kiểm tra mã PIN điểm danh
    if (activeSession.code.toString().trim() !== code.toString().trim()) {
      return { success: false, message: "Sai mã điểm danh PIN Code học tập!" };
    }
    
    // Kiểm tra đã điểm danh trước đó chưa
    const logSheet = ss.getSheetByName("AttendanceLogs");
    const logs = logSheet.getDataRange().getValues();
    for (let k = 1; k < logs.length; k++) {
      if (logs[k][1] === activeSession.id && logs[k][2].toString().toLowerCase() === studentId.toString().toLowerCase()) {
        return { success: false, message: "Bạn đã điểm danh thành công ở phiên này từ trước đó!" };
      }
    }
    
    // Xác định trạng thái muộn hay đúng giờ
    const now = new Date();
    let status = "Hợp lệ";
    if (now.getTime() > activeSession.endTime.getTime()) {
      status = "Muộn";
    }
    
    const logId = "LOG" + now.getTime().toString().substring(8);
    // Lưu bản ghi điểm danh
    logSheet.appendRow([
      logId,
      activeSession.id,
      studentId.toUpperCase(),
      now.toISOString(),
      status,
      "GAS-IP-Gateway",
      gpsInfo || "Không lấy được GPS"
    ]);
    
    return { success: true, message: "Điểm danh thành công! Trạng thái: " + status };
  } catch (err) {
    return { success: false, message: "Có lỗi xảy ra: " + err.toString() };
  }
}

/**
 * 5. Luồng Sinh viên nộp bài tập và Lưu trữ trực tiếp lên Google Drive Folder chính chủ của Thầy
 */
function uploadAssignment(studentId, assignmentId, fileName, base64Data) {
  try {
    // Luôn sử dụng Folder ID chỉ định từ yêu cầu để tránh lưu sai thư mục
    const folderId = "138c-CG-nB7YuXH4Dv-lvkJaI7s6C_7uD";
    const parentFolder = DriveApp.getFolderById(folderId);
    
    // Tách base64 data thực tế khỏi header mimetype của File
    const contentParts = base64Data.split(",");
    let actualData = base64Data;
    let contentType = "application/octet-stream";
    if (contentParts.length > 1) {
      actualData = contentParts[1];
      const mimeMatch = contentParts[0].match(/data:(.*?);base64/);
      if (mimeMatch) {
         contentType = mimeMatch[1];
      }
    }
    
    const blob = Utilities.newBlob(Utilities.base64Decode(actualData), contentType, fileName);
    
    // Tạo file trực tiếp trên Google Drive lưu trữ và phân quyền xem
    const driveFile = parentFolder.createFile(blob);
    driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileUrl = driveFile.getUrl();
    const fileId = driveFile.getId();
    
    // Ghi nhận vào Google Sheets (Bảng Submissions)
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const subSheet = ss.getSheetByName("Submissions");
    
    const now = new Date();
    const submissionId = "SUB" + now.getTime().toString().substring(6);
    
    const data = subSheet.getDataRange().getValues();
    let existingIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][1].toString().toUpperCase() === assignmentId.toString().toUpperCase() && data[i][2].toString().toLowerCase() === studentId.toString().toLowerCase()) {
        existingIndex = i + 1;
        break;
      }
    }
    
    if (existingIndex > -1) {
      // Cập nhật đè dòng cũ
      subSheet.getRange(existingIndex, 4).setValue(now.toISOString());
      subSheet.getRange(existingIndex, 5).setValue(fileUrl);
      subSheet.getRange(existingIndex, 6).setValue(fileId);
    } else {
      // Chèn dòng mới
      subSheet.appendRow([
        submissionId,
        assignmentId.toUpperCase(),
        studentId.toUpperCase(),
        now.toISOString(),
        fileUrl,
        fileId
      ]);
    }
    
    return { 
      success: true, 
      fileId: fileId,
      fileUrl: fileUrl, 
      message: "Hệ thống đã nộp bài vào Google Drive và ghi sổ điểm danh thành công!" 
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * 6. Truy vấn chính xác fileId từ Google Sheets bằng cách khớp mã
 */
function getFileIdBySession(fileId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const subSheet = ss.getSheetByName("Submissions");
    if (!subSheet) return { success: true, fileId: fileId };
    
    const data = subSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const currentFileId = data[i][5] ? data[i][5].toString() : "";
      const currentDriveUrl = data[i][4] ? data[i][4].toString() : "";
      
      if (currentFileId === fileId || currentDriveUrl.indexOf(fileId) > -1) {
        return { success: true, fileId: currentFileId };
      }
    }
    return { success: true, fileId: fileId };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Thêm thành viên mới dạng Sinh viên/Giảng viên vào Google Sheets
 */
function createUser(user) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("Users");
    if (!sheet) return { success: false, error: "Không tìm thấy bảng Users" };
    
    // Kiểm tra trùng ID
    const data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().toUpperCase() === user.id.toUpperCase()) {
        return { success: false, error: "Mã tài khoản đã tồn tại trên Sheet!" };
      }
    }
    
    sheet.appendRow([
      user.id.toUpperCase(),
      user.name,
      user.role || "Student",
      user.className,
      user.password
    ]);
    return { success: true, message: "Đã thêm thành viên mới" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Xóa thành viên khỏi danh sách lớp trên Google Sheets
 */
function deleteUser(userId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("Users");
    if (!sheet) return { success: false, error: "Không tìm thấy bảng Users" };
    
    const data = sheet.getDataRange().getValues();
    var indexToDelete = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().toUpperCase() === userId.toUpperCase()) {
        indexToDelete = i + 1;
        break;
      }
    }
    
    if (indexToDelete > -1) {
      if (data[indexToDelete - 1][2] === "Teacher") {
        return { success: false, error: "Không thể xóa tài khoản Giảng viên!" };
      }
      sheet.deleteRow(indexToDelete);
      return { success: true, message: "Đã xóa thành công khỏi Sheet" };
    }
    return { success: false, error: "Không tìm thấy tài khoản trên Sheet" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Thêm nhiệm vụ bài tập mới vào Google Sheets
 */
function createAssignment(asm) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("Assignments");
    if (!sheet) return { success: false, error: "Không tìm thấy bảng Assignments" };
    
    const data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().toUpperCase() === asm.id.toUpperCase()) {
        return { success: false, error: "Mã nhiệm vụ đã tồn tại!" };
      }
    }
    
    sheet.appendRow([
      asm.id.toUpperCase(),
      asm.title,
      asm.content,
      asm.dueDate
    ]);
    return { success: true, message: "Đã thêm nhiệm vụ mới vào Sheet" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Thêm tin nhắn chat lớp và lưu ảnh đính kèm (nếu có) lên Google Drive
 */
function sendChatMessage(senderId, senderName, senderRole, content, fileName, base64Data) {
  try {
    var imageUrl = "";
    if (base64Data && fileName) {
      // Lưu ảnh đính kèm vào Google Drive
      const folderId = DRIVE_FOLDER_ID || "138c-CG-nB7YuXH4Dv-lvkJaI7s6C_7uD";
      const parentFolder = DriveApp.getFolderById(folderId);
      const contentParts = base64Data.split(",");
      const contentType = contentParts[0].match(/:(.*?);/)[1];
      const actualData = contentParts[1];
      const blob = Utilities.newBlob(Utilities.base64Decode(actualData), contentType, fileName);
      const driveFile = parentFolder.createFile(blob);
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      imageUrl = driveFile.getUrl();
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("ClassChat");
    if (!sheet) return { success: false, error: "Không tìm thấy bảng ClassChat" };
    
    const now = new Date();
    const chatMsgId = "MSG" + now.getTime().toString().substring(5);
    
    sheet.appendRow([
      chatMsgId,
      senderId.toUpperCase(),
      senderName,
      senderRole,
      content,
      now.toISOString(),
      imageUrl
    ]);
    
    return { success: true, messageId: chatMsgId, imageUrl: imageUrl };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * 7. Tích hợp AI Core gọi Gemini thông qua UrlFetchApp để Phân tích tình hình lớp
 */
function analyzeClassDataWithAI() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Gom dữ liệu từ các tab
    const students = ss.getSheetByName("Users").getDataRange().getValues();
    const sessions = ss.getSheetByName("AttendanceSessions").getDataRange().getValues();
    const logs = ss.getSheetByName("AttendanceLogs").getDataRange().getValues();
    const subs = ss.getSheetByName("Submissions").getDataRange().getValues();
    
    const promptContext = "Sinh viên: " + JSON.stringify(students) + 
                          "\\nPhiên: " + JSON.stringify(sessions) + 
                          "\\nLogs: " + JSON.stringify(logs) + 
                          "\\nNộp Bài: " + JSON.stringify(subs);
                          
    const systemPrompt = "Hãy phân tích dữ liệu lớp học, tìm sinh viên vắng nhiều (buổi nghỉ >= 2) và đánh giá kỷ luật nộp bài tập. Viết báo cáo ngắn gọn bằng tiếng Việt.";
    
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY;
    const payload = {
      contents: [{
        parts: [{
          text: systemPrompt + "\\n\\nDữ liệu lớp học của tôi: " + promptContext
        }]
      }]
    };
    
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    return json.candidates[0].content.parts[0].text;
  } catch (err) {
    return "Lỗi phân tích AI: " + err.toString();
  }
}
`;

  const htmlFront = `<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <!-- CSS Bootstrap 5 -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { background-color: #f8f9fa; font-family: system-ui, -apple-system, sans-serif; }
    .card { border: none; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .btn-primary { background: #2563eb; border: none; transition: all 0.2s; }
    .btn-primary:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="container py-4">
    <!-- Header -->
    <div class="row mb-4 text-center">
      <div class="col">
        <h2 class="fw-bold text-dark">NTN Smart Attendance AI Portal</h2>
        <p class="text-secondary">Cổng điểm danh và nộp bài tập dành cho sinh viên Lớp Thầy Nguyễn Trọng Nghĩa</p>
      </div>
    </div>

    <div class="row g-4">
      <!-- Cột 1: Điểm danh thông qua nhập mã PIN -->
      <div class="col-md-6">
        <div class="card p-4 h-100">
          <h4 class="card-title fw-semibold text-primary mb-3">📍 Điểm danh trực tuyến</h4>
          <form id="attendanceForm">
            <div class="mb-3">
              <label class="form-label text-secondary">Mã số Sinh viên (MSSV)</label>
              <input type="text" class="form-control" id="studentId" placeholder="Ví dụ: SV001" required>
            </div>
            <div class="mb-3">
              <label class="form-label text-secondary">Mã điểm danh (6 chữ số)</label>
              <input type="text" class="form-control text-center fs-4 fw-bold" id="pinCode" placeholder="xxxxxx" maxlength="6" required>
            </div>
            <button type="button" class="btn btn-primary w-full" onclick="handleAttendance()">Bấm điểm danh GPS</button>
          </form>
          <div id="attendanceStatus" class="mt-3 alert d-none"></div>
        </div>
      </div>

      <!-- Cột 2: Nộp bài trực tiếp vào Google Drive -->
      <div class="col-md-6">
        <div class="card p-4 h-100">
          <h4 class="card-title fw-semibold text-success mb-3">📁 Nộp bài lên Google Drive</h4>
          <form id="uploadForm">
            <div class="mb-3">
              <label class="form-label text-secondary">MSSV Nộp Bài</label>
              <input type="text" class="form-control" id="submissionStudentId" placeholder="Ví dụ: SV001" required>
            </div>
            <div class="mb-3">
              <label class="form-label text-secondary">Mã Bài Tập</label>
              <input type="text" class="form-control" id="assignmentId" value="ASM001" required>
            </div>
            <div class="mb-3">
              <label class="form-label text-secondary">Chọn tệp bài làm (PDF, ZIP, DOCX...)</label>
              <input type="file" class="form-control" id="fileInput" required>
            </div>
            <button type="button" id="uploadBtn" class="btn btn-success w-full" onclick="handleUpload()">Nộp bài ngay</button>
          </form>
          <div id="uploadStatus" class="mt-3 alert d-none"></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Xử lý nộp file lên Drive thông qua Base64
    function handleUpload() {
      const studentId = document.getElementById("submissionStudentId").value;
      const assignmentId = document.getElementById("assignmentId").value;
      const fileInput = document.getElementById("fileInput");
      const statusDiv = document.getElementById("uploadStatus");
      const btn = document.getElementById("uploadBtn");

      if (!studentId || !assignmentId || !fileInput.files[0]) {
        alert("Vui lòng điền đầy đủ thông tin trước khi nộp!");
        return;
      }

      const file = fileInput.files[0];
      const reader = new FileReader();
      
      btn.disabled = true;
      btn.innerText = "Đang tải tệp lên Drive...";
      statusDiv.className = "mt-3 alert alert-info";
      statusDiv.innerText = "Đang đọc tệp và tải lên máy chủ Google Drive...";
      statusDiv.classList.remove("d-none");

      reader.onload = function(e) {
        const base64Data = e.target.result;
        
        // Gọi hàm Apps Script ở Backend
        google.script.run
          .withSuccessHandler(function(res) {
            btn.disabled = false;
            btn.innerText = "Nộp bài ngay";
            if (res.success) {
              statusDiv.className = "mt-3 alert alert-success";
              statusDiv.innerHTML = "🎉 " + res.message + " <br><a href='" + res.fileUrl + "' target='_blank' class='alert-link'>Xem file của bạn trên Drive</a>";
            } else {
              statusDiv.className = "mt-3 alert alert-danger";
              statusDiv.innerText = "Có lỗi xảy ra: " + res.error;
            }
          })
          .withFailureHandler(function(err) {
            btn.disabled = false;
            btn.innerText = "Nộp bài ngay";
            statusDiv.className = "mt-3 alert alert-danger";
            statusDiv.innerText = "Lỗi kết nối Server Apps Script: " + err;
          })
          .uploadAssignment(studentId, assignmentId, file.name, base64Data);
      };
      
      reader.readAsDataURL(file);
    }

    // Xử lý Điểm danh có bám GPS
    function handleAttendance() {
      const studentId = document.getElementById("studentId").value;
      const pin = document.getElementById("pinCode").value;
      const statusDiv = document.getElementById("attendanceStatus");

      if (!studentId || !pin) {
        alert("Vui lòng nhập đầy đủ MSSV và mã PIN điểm danh!");
        return;
      }

      statusDiv.className = "mt-3 alert alert-info";
      statusDiv.innerText = "Đang tải tọa độ định vị GPS...";
      statusDiv.classList.remove("d-none");

      // Lấy GPS thực tế của trình duyệt sinh viên
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          function(position) {
            const gps = position.coords.latitude + ", " + position.coords.longitude;
            callAttendanceScript(studentId, pin, gps);
          },
          function(error) {
            callAttendanceScript(studentId, pin, "Không được cấp quyền GPS");
          }
        );
      } else {
        callAttendanceScript(studentId, pin, "Thiết bị không hỗ trợ GPS");
      }
    }

    function callAttendanceScript(studentId, pin, gps) {
      const statusDiv = document.getElementById("attendanceStatus");
      statusDiv.innerText = "Đang gửi tín hiệu điểm danh về Google Sheets...";

      google.script.run
        .withSuccessHandler(function(res) {
          if (res.success) {
            statusDiv.className = "mt-3 alert alert-success";
            statusDiv.innerText = "🎉 " + res.message;
          } else {
            statusDiv.className = "mt-3 alert alert-danger";
            statusDiv.innerText = "❌ " + res.message;
          }
        })
        .withFailureHandler(function(err) {
          statusDiv.className = "mt-3 alert alert-danger";
          statusDiv.innerText = "Lỗi kết nối: " + err;
        })
        .submitAttendance(studentId, pin, gps);
    }
  </script>
</body>
</html>
`;

  return (
    <div className="space-y-6" id="gas-guide-section">
      {/* KHU VỰC CẤU HÌNH LIÊN KẾT GOOGLE WORKSPACE CHUYÊN NGHIỆP */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-lg border border-indigo-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Đồng bộ dữ liệu hai chiều
            </div>
            <h3 className="text-2xl font-bold font-sans tracking-tight">Cấu hình liên kết Google Apps Script</h3>
            <p className="text-sm text-indigo-200/80 leading-relaxed">
              Dán URL Ứng dụng Web (Web App URL) được cấp sau khi bạn triển khai thành công mã nguồn Apps Script ở bên dưới để kết nối hệ thống này trực tiếp với Google Drive và Google Sheets thật.
            </p>
          </div>
          
          <div className="flex-shrink-0">
            {scriptUrl ? (
              <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-medium">
                ● ĐÃ KẾT NỐI GOOGLE WORKSPACE
              </div>
            ) : (
              <div className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-medium">
                ○ CHẾ ĐỘ MÔ PHỎNG (Sử dụng RAM)
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveConfig} className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="url"
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              value={scriptUrl}
              onChange={(e) => setScriptUrl(e.target.value)}
              className="w-full h-11 pl-4 pr-4 rounded-xl bg-slate-950/40 border border-indigo-700/50 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="h-11 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Đang thiết lập...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Lưu cấu hình
              </>
            )}
          </button>
        </form>

        {saveStatus && (
          <div className={`mt-4 p-3.5 rounded-xl text-xs font-medium border ${
            saveStatus.type === "success" 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
              : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          }`}>
            {saveStatus.text}
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm">
        <h2 className="text-2xl font-bold font-sans text-slate-800 tracking-tight flex items-center gap-3">
          <FolderGit className="w-7 h-7 text-indigo-600" />
          Kiến trúc Mã nguồn Google Workspace (Apps Script)
        </h2>
        <p className="text-slate-500 mt-2 text-sm leading-relaxed max-w-3xl">
          Hệ thống được thiết kế tối thiểu hóa chi phí hạ tầng (0đ) bằng cách tận dụng tài khoản Google cá nhân. 
          Toàn bộ quy trình xử lý dữ liệu viết trong Google Apps Script, kết hợp Drive lưu file nộp bài diện rộng của sinh viên và Sheets ghi nhận logs.
        </p>

        {/* Thư mục lưu trữ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="border border-slate-100 bg-slate-50/50 rounded-2xl p-4 flex gap-4 items-start">
            <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl mt-1">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 font-sans">Google Sheets</h4>
              <p className="text-xs text-slate-500 mt-1 lines-clamp-2">Lưu trữ các bảng: Users, Sessions, AttendanceLogs, Assignments, Submissions.</p>
            </div>
          </div>
          <div className="border border-slate-100 bg-slate-50/50 rounded-2xl p-4 flex gap-4 items-start">
            <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl mt-1">
              <AppWindow className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 font-sans">Google Drive</h4>
              <p className="text-xs text-slate-500 mt-1 lines-clamp-2">Nơi lưu trữ file bài nộp (PDF, ZIP, DOCX). Phân quyền tự động xem cho thầy cô.</p>
            </div>
          </div>
          <div className="border border-slate-100 bg-slate-50/50 rounded-2xl p-4 flex gap-4 items-start">
            <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl mt-1">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 font-sans">Google Apps Script</h4>
              <p className="text-xs text-slate-500 mt-1 lines-clamp-2">Trình biên tập backend thông minh, mở luồng Web App trực tiếp cho SV truy cập.</p>
            </div>
          </div>
        </div>

        {/* Guide step-by-step */}
        <div className="mt-8 border-t border-slate-100 pt-6">
          <h3 className="text-lg font-bold font-sans text-slate-800">Hướng dẫn cài đặt hệ thống thực tế (G-Suite)</h3>
          <div className="mt-4 space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">1</div>
              <div>
                <h5 className="text-sm font-semibold text-slate-800">Tạo File Cơ Sở Dữ Liệu</h5>
                <p className="text-xs text-slate-500 mt-1">
                  Tạo một file <b>Google Sheets</b> mới và tạo một thư mục rỗng trong <b>Google Drive</b> để lưu tài liệu. Sao chép ID của Sheet (trong URL) và ID của Folder Drive để lát nữa điền vào code.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">2</div>
              <div>
                <h5 className="text-sm font-semibold text-slate-800">Cấu hình Apps Script</h5>
                <p className="text-xs text-slate-500 mt-1">
                  Trong file Google Sheets của bạn, bấm vào <b>Tiện ích mở rộng &gt; Apps Script</b>. 
                  Tạo 2 tệp: Tệp <code>Code.gs</code> (mã kịch bản) và tệp HTML đặt tên chính xác là <code>Index.html</code> (giao diện).
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">3</div>
              <div>
                <h5 className="text-sm font-semibold text-slate-800">Tiến hành chạy Setup & Deploy</h5>
                <p className="text-xs text-slate-500 mt-1">
                  Chạy hàm <code>setupDatabase()</code> trong Apps Script lần đầu tiên để tự động khởi tạo tất cả các Sheet cần thiết. 
                  Sau đó bấm vào <b>Triển khai (Deploy) &gt; Tùy chọn Triển khai mới &gt; Ứng dụng web (Web App)</b>. Chọn quyền truy cập: <b>'Cho phép bất kỳ ai (Anyone)'</b>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Code sections tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Code.gs */}
        <div className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 flex flex-col h-[550px]" id="code-gs-block">
          <div className="bg-slate-950 px-6 py-4 flex justify-between items-center border-b border-slate-800">
            <div className="flex items-center gap-3">
              <FileCode className="w-5 h-5 text-amber-500" />
              <div>
                <h4 className="text-sm font-bold text-white font-mono">Code.gs</h4>
                <p className="text-[10px] text-slate-400">Đoạn code Apps Script Backend chính</p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(codeGs, "gs")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              {copiedType === "gs" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold font-sans">Đã copy!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="font-sans">Sao chép Code</span>
                </>
              )}
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 md:p-6 text-slate-300 font-mono text-xs leading-relaxed focus:outline-none">
            <pre className="text-left w-full whitespace-pre select-all text-emerald-300 bg-transparent">
              {codeGs}
            </pre>
          </div>
        </div>

        {/* Index.html */}
        <div className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 flex flex-col h-[550px]" id="index-html-block">
          <div className="bg-slate-950 px-6 py-4 flex justify-between items-center border-b border-slate-800">
            <div className="flex items-center gap-3">
              <Code className="w-5 h-5 text-cyan-400" />
              <div>
                <h4 className="text-sm font-bold text-white font-mono">Index.html</h4>
                <p className="text-[10px] text-slate-400">Giao diện đăng ký nhập mã của Sinh viên</p>
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(htmlFront, "html")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              {copiedType === "html" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold font-sans">Đã copy!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="font-sans">Sao chép Code</span>
                </>
              )}
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 md:p-6 text-slate-300 font-mono text-xs leading-relaxed focus:outline-none">
            <pre className="text-left w-full whitespace-pre select-all text-cyan-300 bg-transparent">
              {htmlFront}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
