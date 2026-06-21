import React, { useState } from "react";
import { AttendanceSession, AttendanceLog, User } from "../types";
import { BarChart3, Users, CheckCircle, TrendingUp, AlertTriangle, UserX, Search } from "lucide-react";

interface AttendanceChartProps {
  sessions: AttendanceSession[];
  logs: AttendanceLog[];
  students: User[];
}

export const AttendanceChart: React.FC<AttendanceChartProps> = ({
  sessions,
  logs,
  students
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    sessions.length > 0 ? sessions[sessions.length - 1].id : null
  );

  // Filter students based on role
  const totalStudentsCount = students.length;

  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium text-sm">Chưa có phiên điểm danh nào được kích hoạt để phân tích biểu đồ.</p>
      </div>
    );
  }

  // Calculate stats for each session
  const chartData = sessions.map((s) => {
    // Unique student ids who successfully logged attendance for this session
    const uniqueAttendees = Array.from(
      new Set(
        logs
          .filter((l) => l.sessionId === s.id)
          .map((l) => l.studentId.trim().toLowerCase())
      )
    );

    const attendedCount = uniqueAttendees.length;
    const rate = totalStudentsCount > 0 ? Math.round((attendedCount / totalStudentsCount) * 100) : 0;

    return {
      id: s.id,
      code: s.code,
      date: s.date || new Date(s.startTime).toLocaleDateString("vi-VN"),
      className: s.className,
      attendedCount,
      totalCount: totalStudentsCount,
      rate,
      isActive: s.isActive
    };
  });

  // Overall Statistics
  const totalLogsCount = logs.length;
  const avgAttendancePercentage =
    chartData.length > 0
      ? Math.round(chartData.reduce((acc, curr) => acc + curr.rate, 0) / chartData.length)
      : 0;

  // Find max rate and min rate session
  const sortedByRate = [...chartData].sort((a, b) => b.rate - a.rate);
  const bestSession = sortedByRate[0];
  const worstSession = sortedByRate[sortedByRate.length - 1];

  // Currently viewing session for attendance details
  const activeDetailId = selectedSessionId || (sessions.length > 0 ? sessions[sessions.length - 1].id : null);
  const activeDetailSession = chartData.find((d) => d.id === activeDetailId);

  // List students and their attendance status for the active detail session
  const getStudentStatusList = () => {
    if (!activeDetailId) return [];

    const attendedIds = new Set(
      logs
        .filter((l) => l.sessionId === activeDetailId)
        .map((l) => l.studentId.trim().toLowerCase())
    );

    return students.map((student) => {
      const dbIdNormalized = student.id.trim().toLowerCase();
      const attended = attendedIds.has(dbIdNormalized);
      const log = logs.find(
        (l) => l.sessionId === activeDetailId && l.studentId.trim().toLowerCase() === dbIdNormalized
      );

      return {
        ...student,
        attended,
        time: log ? new Date(log.time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : null,
        status: log ? log.status : "Vắng"
      };
    });
  };

  const studentStatusList = getStudentStatusList();
  const presentCount = studentStatusList.filter((s) => s.attended).length;
  const absentCount = studentStatusList.length - presentCount;

  // Chart layout calculations
  const maxBarHeight = 160; // Max pixels for 100%
  const barWidth = 32;
  const gap = 20;
  const svgWidth = Math.max(500, chartData.length * (barWidth + gap) + 60);
  const svgHeight = 220;

  return (
    <div className="space-y-6">
      {/* 4 Core metrics breakdown widget */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tỷ lệ đi học TB</p>
            <p className="text-xl font-extrabold text-slate-850 font-sans">{avgAttendancePercentage}%</p>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tốt nhất</p>
            <p className="text-xl font-extrabold text-slate-850 font-sans truncate max-w-[120px]" title={bestSession?.date}>
              {bestSession ? `${bestSession.rate}% (${bestSession.date})` : "--"}
            </p>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Yếu nhất</p>
            <p className="text-xl font-extrabold text-slate-850 font-sans truncate max-w-[120px]" title={worstSession?.date}>
              {worstSession ? `${worstSession.rate}% (${worstSession.date})` : "--"}
            </p>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng SV Đi học</p>
            <p className="text-xl font-extrabold text-slate-850 font-sans">{totalLogsCount} lượt</p>
          </div>
        </div>
      </div>

      {/* Main Bar Chart Visualization */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm md:text-base flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              Biểu đồ trực quan tỉ lệ điểm danh qua từng buổi
            </h3>
            <p className="text-slate-400 text-[11px] font-sans mt-0.5">Nhấp vào từng cột mốc để xem chi tiết danh sách đi học & vắng</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-indigo-600 rounded"></span> Chuyên cần &gt;= 75%
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-amber-500 rounded"></span> Chuyên cần &lt; 75%
            </div>
          </div>
        </div>

        <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          <div style={{ minWidth: `${svgWidth}px` }} className="relative h-[250px] pt-4">
            <svg width="100%" height={svgHeight} className="overflow-visible">
              {/* Y-axis Guides */}
              {[0, 25, 50, 75, 100].map((tick, i) => {
                const y = svgHeight - 40 - (tick / 100) * maxBarHeight;
                return (
                  <g key={tick} className="opacity-40">
                    <line
                      x1="40"
                      y1={y}
                      x2="98%"
                      y2={y}
                      stroke="#cbd5e1"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x="25"
                      y={y + 4}
                      fill="#64748b"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="end"
                      className="font-mono"
                    >
                      {tick}%
                    </text>
                  </g>
                );
              })}

              {/* Bars rendering */}
              {chartData.map((data, index) => {
                const x = 50 + index * (barWidth + gap);
                const barHeight = (data.rate / 100) * maxBarHeight;
                const y = svgHeight - 40 - barHeight;
                const isSelected = activeDetailId === data.id;

                // Color schemes based on active/selected/rate
                const barColor = data.rate >= 75 ? "fill-indigo-600" : "fill-amber-500";
                const barOpacity = isSelected ? "opacity-100" : "opacity-80 hover:opacity-105 transition-opacity";

                return (
                  <g
                    key={data.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedSessionId(data.id)}
                  >
                    {/* Shadow block highlight behind selected bar */}
                    {isSelected && (
                      <rect
                        x={x - gap / 3}
                        y="10"
                        width={barWidth + gap * (2 / 3)}
                        height={svgHeight - 40}
                        fill="#f1f5f9"
                        rx="8"
                        className="opacity-60"
                      />
                    )}

                    {/* Bar rectangle */}
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(4, barHeight)} // Minimum 4px height for visual elegance
                      className={`${barColor} ${barOpacity}`}
                      rx="6"
                    />

                    {/* Percentage text above bar */}
                    <text
                      x={x + barWidth / 2}
                      y={y - 8}
                      textAnchor="middle"
                      fill={isSelected ? "#1e1b4b" : "#475569"}
                      fontSize="10"
                      fontWeight="extrabold"
                      className="font-sans"
                    >
                      {data.rate}%
                    </text>

                    {/* Label (Session Code) at X-axis */}
                    <text
                      x={x + barWidth / 2}
                      y={svgHeight - 22}
                      textAnchor="middle"
                      fill={isSelected ? "#4f46e5" : "#64748b"}
                      fontSize="11"
                      fontWeight="bold"
                      className="font-mono"
                    >
                      {data.id}
                    </text>

                    {/* Sub title (Date/Class) below session identifier */}
                    <text
                      x={x + barWidth / 2}
                      y={svgHeight - 8}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="8"
                      fontWeight="bold"
                      className="font-sans uppercase"
                    >
                      {data.date.split("/").slice(0, 2).join("/")}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Drill-down student lists details for selected session */}
      {activeDetailSession && (
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 shadow-inner grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Header & Quick ratio card left inside */}
          <div className="md:col-span-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <span className="inline-block text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-full font-mono mb-2">
                Phiên Chọn: {activeDetailSession.id}
              </span>
              <h4 className="font-extrabold text-slate-800 text-sm leading-snug">
                Phân Tích Chi Tiết Buổi ngày {activeDetailSession.date}
              </h4>
              <p className="text-slate-400 text-xs mt-1">Đã điểm danh hợp lệ:</p>
              <div className="text-3xl font-extrabold text-slate-805 font-sans mt-1.5 flex items-baseline gap-1">
                <span className="text-indigo-600">{presentCount}</span>
                <span className="text-slate-300 text-xl font-normal">/</span>
                <span className="text-slate-500 text-xl font-medium">{totalStudentsCount}</span>
                <span className="text-xs font-semibold text-slate-400 italic font-mono ml-2">({activeDetailSession.rate}%)</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Đi học đúng giờ:
                </span>
                <span className="font-bold text-slate-800">{presentCount} SV</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span> Vắng mặt buổi học:
                </span>
                <span className="font-bold text-rose-600">{absentCount} SV</span>
              </div>
            </div>
          </div>

          {/* User grid table right side inside */}
          <div className="md:col-span-8 flex flex-col h-full bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden min-h-[220px]">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider font-mono">Bảng chi tiết lớp: {activeDetailSession.className || "Tất cả"}</span>
              <span className="text-[10px] text-slate-400 italic">Nhấp vào biểu đồ cột để đổi buổi</span>
            </div>
            
            <div className="p-3 flex-1 overflow-y-auto max-h-[180px] scrollbar-thin">
              <div className="space-y-1.5">
                {studentStatusList.map((st) => (
                  <div
                    key={st.id}
                    className={`flex items-center justify-between text-xs p-2 rounded-lg border transition-colors ${
                      st.attended
                        ? "bg-emerald-50/40 border-emerald-100 hover:bg-emerald-50"
                        : "bg-rose-50/30 border-rose-100 hover:bg-rose-50/60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${st.attended ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                      <span className="font-mono text-slate-400 font-semibold">{st.id}</span>
                      <span className="font-extrabold text-slate-700">{st.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded font-mono uppercase font-bold">{st.className}</span>
                    </div>

                    <div className="flex items-center gap-2 font-mono">
                      {st.attended ? (
                        <>
                          <span className="text-[10px] text-emerald-600 bg-emerald-100/60 px-1.5 py-0.5 rounded font-extrabold uppercase">Có mặt</span>
                          <span className="text-[10px] text-slate-400 font-medium">{st.time}</span>
                        </>
                      ) : (
                        <span className="text-[10px] text-rose-600 bg-rose-100/60 px-1.5 py-0.5 rounded font-extrabold uppercase">Vắng</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
