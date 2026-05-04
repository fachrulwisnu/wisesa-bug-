/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { BugRecord, DevStats } from "../types";
import { FileDown, Printer } from "lucide-react";

interface DashboardChartsProps {
  devStats: DevStats[];
  allBugs: BugRecord[];
  selectedSeverity?: string;
  onExportPDF?: (id: string, name: string) => void;
  onChartClick?: (type: string, value: string) => void;
}

const COLORS = {
  Recurring: "#8B5CF6", // Purple
  Critical: "#EF4444",  // Red
  Major: "#F59E0B",     // Orange
  Minor: "#3B82F6",     // Blue
  Trivia: "#10B981",    // Green
};

export function DashboardCharts({ devStats, allBugs, selectedSeverity, onExportPDF, onChartClick }: DashboardChartsProps) {
  // Severity Distribution Data
  const severityCounts = allBugs.reduce((acc: any, bug) => {
    acc[bug.severity] = (acc[bug.severity] || 0) + 1;
    return acc;
  }, {});

  const severityData = Object.keys(severityCounts).map((key) => ({
    name: key,
    value: severityCounts[key],
  }));

  // Stacked Monthly Trend Data
  const trendDataMap = allBugs.reduce((acc: any, bug) => {
    const month = bug.periode || "Unknown";
    if (!acc[month]) {
      acc[month] = {
        periode: month,
        Recurring: 0,
        Critical: 0,
        Major: 0,
        Minor: 0,
        Trivia: 0,
        Bug: 0,
        "Change Request": 0,
      };
    }
    const sev = bug.severity;
    if (acc[month][sev] !== undefined) {
      acc[month][sev] += 1;
    }
    
    const type = bug.type === "Bug" ? "Bug" : "Change Request";
    acc[month][type] += 1;
    
    return acc;
  }, {});

  const trendChartData = Object.values(trendDataMap)
    .sort((a: any, b: any) => {
      const getMonthVal = (s: string) => {
        if (!s) return 0;
        const parts = s.includes('-') ? s.split('-') : s.split(' ');
        if (parts.length === 2) {
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const mIdx = months.findIndex(m => m.toLowerCase().startsWith(parts[0].toLowerCase().substring(0, 3)));
          let year = parseInt(parts[1]);
          if (parts[1].length === 2) year += 2000;
          if (!isNaN(year) && mIdx !== -1) {
            return (year * 12) + mIdx;
          }
        }
        return 0;
      };
      return getMonthVal(a.periode) - getMonthVal(b.periode) || a.periode.localeCompare(b.periode);
    });

  const categories = ["Recurring", "Critical", "Major", "Minor", "Trivia"];

  return (
    <div className="space-y-10 mb-10">
      {/* Combined Group 1: Personnel & Severity */}
      <div id="chart-matrix-group" className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
            <div>
              <h2 className="text-xl font-display font-bold text-white tracking-tight">Personnel & Severity Matrix</h2>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-0.5">Cross-sectional impact analysis</p>
            </div>
          </div>
          <button 
            onClick={() => onExportPDF?.("chart-matrix-group", "Personnel-Severity-Matrix")}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-black text-slate-400 hover:text-white transition-all uppercase tracking-widest group shadow-lg"
          >
            <Printer className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
            Capture Matrix PDF
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dev Quality Ranking */}
          <div id="chart-dev-ranking" className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full" />
        
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-display font-bold text-white tracking-tight">Personnel Governance Ranking</h3>
          <button 
            onClick={() => onExportPDF?.("chart-dev-ranking", "Personnel-Governance-Ranking")}
            className="p-2 transition-all text-slate-600 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl"
            title="Export to PDF"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>

        <div className="h-[280px] w-full min-h-0 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={devStats.slice(0, 10)} 
              margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              onClick={(data: any) => {
                if (data && data.activePayload && data.activePayload[0]) {
                  onChartClick?.("dev", String(data.activePayload[0].payload.devName));
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" strokeOpacity={0.5} />
              <XAxis dataKey="devName" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
              <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                contentStyle={{ 
                  backgroundColor: "#0f172a", 
                  borderRadius: "16px", 
                  border: "1px solid #1e293b", 
                  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                  color: "#f8fafc"
                }}
              />
              <Bar dataKey="totalScore" fill="#3B82F6" radius={[8, 8, 0, 0]} barSize={32}>
                 {devStats.slice(0, 10).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? "#ef4444" : "#3b82f6"} />
                 ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Severity Distribution */}
      <div id="chart-severity-index" className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-2xl relative overflow-hidden group">
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full" />
        
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-display font-bold text-white tracking-tight">Systemic Severity Index</h3>
          <button 
            onClick={() => onExportPDF?.("chart-severity-index", "Systemic-Severity-Index")}
            className="p-2 transition-all text-slate-600 hover:text-purple-500 hover:bg-purple-500/10 rounded-xl"
            title="Export to PDF"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>

        <div className="h-[280px] w-full flex items-center justify-center min-h-0 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={severityData}
                innerRadius={65}
                outerRadius={95}
                paddingAngle={8}
                dataKey="value"
                label={({ name, percent }) => `${name.toUpperCase()} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
                onClick={(data: any) => {
                  if (data && data.name) {
                    onChartClick?.("severity", String(data.name));
                  }
                }}
              >
                {severityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || "#CBD5E1"} stroke="none" />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderRadius: "16px", border: "1px solid #1e293b" }} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  </div>

  {/* Monthly SIT Trend (Stacked Area) */}
      <div id="chart-sit-trend" className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-2xl lg:col-span-2 group relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="flex items-center justify-between mb-8 relative z-10">
          <div>
            <h3 className="text-lg font-display font-bold text-white tracking-tight">Monthly SIT Resilience Trend</h3>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Cross-sectional volume analysis</p>
          </div>
          <div className="flex items-center gap-4">
            {selectedSeverity && selectedSeverity !== "All" && (
              <span className="text-[9px] bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full font-black uppercase tracking-widest border border-blue-500/20">
                Isolating: {selectedSeverity}
              </span>
            )}
            <button 
              onClick={() => onExportPDF?.("chart-sit-trend", "Monthly-SIT-Trend")}
              className="flex items-center gap-2 px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-black text-slate-400 hover:text-white transition-all uppercase tracking-widest group shadow-lg"
            >
              <Printer className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
              Capture Trend PDF
            </button>
          </div>
        </div>
        <div className="h-[320px] w-full min-h-0 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={trendChartData} 
              margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              onClick={(data: any) => {
                if (data && data.activeLabel) {
                  onChartClick?.("trend", String(data.activeLabel));
                }
              }}
            >
              <defs>
                {categories.map(cat => (
                  <linearGradient key={`grad-${cat}`} id={`color-${cat}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[cat as keyof typeof COLORS]} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={COLORS[cat as keyof typeof COLORS]} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" strokeOpacity={0.5} />
              <XAxis dataKey="periode" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
              <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
              <Tooltip
                contentStyle={{ 
                  backgroundColor: "#0f172a", 
                  borderRadius: "20px", 
                  border: "1px solid #1e293b", 
                  boxShadow: "0 30px 60px -12px rgba(0,0,0,1)", 
                  padding: "20px" 
                }}
                itemStyle={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}
              />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '30px', fontSize: '10px', fontWeight: 'bold' }} />
              {categories.map(cat => {
                const isFiltered = !selectedSeverity || selectedSeverity === "All" || selectedSeverity === cat;
                if (!isFiltered) return null;
                
                return (
                  <Area
                    key={cat}
                    type="monotone"
                    dataKey={cat}
                    stackId="1"
                    stroke={COLORS[cat as keyof typeof COLORS]}
                    fillOpacity={1}
                    fill={`url(#color-${cat})`}
                    strokeWidth={3}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bug vs CR Comparison */}
      <div id="chart-issue-variance" className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-2xl lg:col-span-2 group relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="flex items-center justify-between mb-8 relative z-10">
          <div>
            <h3 className="text-lg font-display font-bold text-white tracking-tight">Issue Type Variance</h3>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Bug vs Change Request distribution</p>
          </div>
          <button 
            onClick={() => onExportPDF?.("chart-issue-variance", "Issue-Type-Variance")}
            className="flex items-center gap-2 px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-black text-slate-400 hover:text-white transition-all uppercase tracking-widest group shadow-lg"
          >
            <Printer className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
            Capture Variance PDF
          </button>
        </div>
        <div className="h-[280px] w-full min-h-0 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={trendChartData} 
              margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              onClick={(data: any) => {
                if (data && data.activeLabel) {
                  onChartClick?.("variance", String(data.activeLabel));
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" strokeOpacity={0.5} />
              <XAxis dataKey="periode" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
              <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#64748b' }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderRadius: "16px", border: "1px solid #1e293b" }}
              />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 'bold' }} />
              <Bar dataKey="Bug" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={24} />
              <Bar dataKey="Change Request" fill="#10B981" radius={[4, 4, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
