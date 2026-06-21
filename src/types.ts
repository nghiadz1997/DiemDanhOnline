export interface User {
  id: string;
  name: string;
  role: "Admin" | "Teacher" | "Student";
  className: string;
}

export interface AttendanceSession {
  id: string;
  className: string;
  code: string;
  startTime: string;
  durationMinutes: number;
  date: string;
  isActive: boolean;
}

export interface AttendanceLog {
  id: string;
  sessionId: string;
  studentId: string;
  time: string;
  status: "Hợp lệ" | "Muộn";
  ip: string;
}

export interface Assignment {
  id: string;
  title: string;
  content: string;
  dueDate: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  time: string;
  driveUrl: string;
  fileName: string;
  fileSize: string;
  fileData?: string;
}

export interface DatabaseState {
  users: User[];
  attendanceSessions: AttendanceSession[];
  attendanceLogs: AttendanceLog[];
  assignments: Assignment[];
  submissions: Submission[];
}
