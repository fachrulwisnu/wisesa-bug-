/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { TrendingDown, Star, ArrowUpRight, ArrowDownRight, AlertCircle, ShieldCheck, Printer } from "lucide-react";
import { DevStats } from "../types";
import { motion } from "motion/react";
import { cn } from "../lib/utils";

interface ExecutivePerformanceProps {
  devStats: DevStats[];
  onDevClick: (devName: string) => void;
  onExportPDF?: (id: string, fileName: string) => void;
}

export function ExecutivePerformance({ devStats, onDevClick, onExportPDF }: ExecutivePerformanceProps) {
  // Sort for Top Risk (Highest Score)
  const topRisk = [...devStats].sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);
  
  // Sort for Top Performers (Lowest Score)
  const topPerformers = [...devStats]
    .filter(d => d.totalScore < 10 && d.bugCount > 0) // Only those with minimal issues but active
    .sort((a, b) => a.totalScore - b.totalScore)
    .slice(0, 3);

  // If no one meets the < 10 threshold, just take the bottom 3
  const finalPerformers = topPerformers.length > 0 ? topPerformers : [...devStats].sort((a, b) => a.totalScore - b.totalScore).slice(0, 3);

  return (
    <div id="executive-performance-section" className="space-y-6 mb-8">
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
          <h2 className="text-xl font-display font-bold text-white tracking-tight">Personnel Performance & Risk</h2>
        </div>
        <button 
          onClick={() => onExportPDF?.("executive-performance-section", "Personnel-Performance-Audit")}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-black text-slate-400 hover:text-white transition-all uppercase tracking-widest group"
        >
          <Printer className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
          Export Performance PDF
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Performers (Emerald) */}
        <div className="bg-slate-900 border border-emerald-500/10 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
          <Star className="w-32 h-32 text-emerald-500" />
        </div>
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <h3 className="text-xl font-display font-bold text-white tracking-tight">Top Efficient Performers</h3>
            </div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest pl-7 text-emerald-500/60">Minimum Impact • High Integrity</p>
          </div>
          <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[9px] font-black text-emerald-500 uppercase tracking-widest">
            Star Ranking
          </div>
        </div>

        <div className="space-y-4 relative z-10">
          {finalPerformers.map((dev, idx) => (
            <motion.div 
              key={dev.devName}
              whileHover={{ x: 5 }}
              onClick={() => onDevClick(dev.devName)}
              className="flex items-center justify-between p-4 bg-slate-950/50 border border-white/5 rounded-2xl hover:border-emerald-500/30 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold text-xs ring-4 ring-emerald-500/5">
                  #{idx + 1}
                </div>
                <div>
                  <div className="text-sm font-bold text-white tracking-tight">{dev.devName}</div>
                  <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-0.5">{dev.bugCount} Total Items</div>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className="text-sm font-black text-emerald-500 tracking-tighter flex items-center gap-1">
                  <ArrowDownRight className="w-3 h-3" />
                  {dev.totalScore.toFixed(1)}
                </div>
                <div className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">Penalty Score</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Top Risks (Red) */}
      <div className="bg-slate-900 border border-red-500/10 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
          <AlertCircle className="w-32 h-32 text-red-500" />
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-5 h-5 text-red-500" />
              <h3 className="text-xl font-display font-bold text-white tracking-tight">Critical Accountability Risk</h3>
            </div>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest pl-7 text-red-500/60">High Governance Liability</p>
          </div>
          <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-[9px] font-black text-red-500 uppercase tracking-widest">
            Audit Priority
          </div>
        </div>

        <div className="space-y-4 relative z-10">
          {topRisk.map((dev, idx) => (
            <motion.div 
              key={dev.devName}
              whileHover={{ x: 5 }}
              onClick={() => onDevClick(dev.devName)}
              className="flex items-center justify-between p-4 bg-slate-950/50 border border-white/5 rounded-2xl hover:border-red-500/30 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 font-bold text-xs ring-4 ring-red-500/5">
                  #{idx + 1}
                </div>
                <div>
                  <div className="text-sm font-bold text-white tracking-tight">{dev.devName}</div>
                  <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-0.5">{dev.bugCount} Defects</div>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className="text-sm font-black text-red-500 tracking-tighter flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" />
                  {dev.totalScore.toFixed(1)}
                </div>
                <div className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">Critical Score</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
}
