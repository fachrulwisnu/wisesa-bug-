/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight, CheckCircle2, Clock, MoreHorizontal, AlertCircle, Eye, X, Bug, Info, User, Layers, Calendar as CalendarIcon, ShieldAlert, History, Edit3, Save } from "lucide-react";
import { BugRecord, AppUser } from "../types";
import { cn } from "../lib/utils";
import { normalizeStatus } from "../lib/normalization";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";

interface DataTableProps {
  bugs: BugRecord[];
  dark?: boolean;
  hideFilters?: boolean;
  currentUser?: AppUser | null;
  onUpdateBug?: (id: string, updates: Partial<BugRecord>) => Promise<void>;
  onExportExcel?: (data: BugRecord[], filename: string) => void;
  onExportPDF?: (id: string, filename: string) => void;
}

export function DataTable({ bugs, dark, className, hideFilters, currentUser, onUpdateBug, onExportExcel, onExportPDF }: DataTableProps & { className?: string }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [projectFilter, setProjectFilter] = useState("All");
  const [devFilter, setDevFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedBug, setSelectedBug] = useState<BugRecord | null>(null);

  // States for Inline Editing in Modal
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState<Partial<BugRecord>>({});
  const [isSaving, setIsSaving] = useState(false);

  const isSuperAdmin = currentUser?.role === "super_admin";

  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const YEARS = ["2024", "2025", "2026"];
  const PERIODS = useMemo(() => {
    const list: string[] = [];
    YEARS.forEach(y => MONTHS.forEach(m => list.push(`${m}-${y}`)));
    return list;
  }, []);

  const STATUS_OPTIONS = ["DONE", "ON PROGRESS", "ON QUEUE", "PENDING"];

  useEffect(() => {
    if (selectedBug) {
      setEditFields({
        periode: selectedBug.periode,
        statusDev: selectedBug.statusDev,
        includedInFsd: selectedBug.includedInFsd,
        discoveryDate: selectedBug.discoveryDate,
        sitRealizedDate: selectedBug.sitRealizedDate,
        responseDev: selectedBug.responseDev,
        statusPic: selectedBug.statusPic,
        startDate: selectedBug.startDate,
        finishAt: selectedBug.finishAt,
      });
      setIsEditing(false);
    }
  }, [selectedBug]);

  const handleSaveEdit = async () => {
    if (!selectedBug?.id || !onUpdateBug) return;
    setIsSaving(true);
    try {
      await onUpdateBug(selectedBug.id, editFields);
      // Update local selected bug to reflect changes
      setSelectedBug({ ...selectedBug, ...editFields });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const projects = Array.from(new Set(bugs.map((b) => b.projectName))).filter(Boolean);
  const developers = Array.from(new Set(bugs.map((b) => b.devName))).filter(Boolean);
  
  // Standardize Statuses for filtering
  const statuses = ["All", "DONE", "ON PROGRESS", "ON QUEUE", "PENDING", "UNMAPPED"];

  const filteredBugs = useMemo(() => {
    return bugs.filter((bug) => {
      const consolidatedStatus = normalizeStatus(bug.statusDev);
      
      const matchesSearch =
        (bug.remarks || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bug.projectName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bug.devName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (bug.sectionName || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProject = !projectFilter || projectFilter === "All" || bug.projectName?.toLowerCase().includes(projectFilter.toLowerCase());
      const matchesDev = !devFilter || devFilter === "All" || bug.devName?.toLowerCase().includes(devFilter.toLowerCase());
      const matchesStatus = statusFilter === "All" || consolidatedStatus === statusFilter;
      
      return matchesSearch && matchesProject && matchesDev && matchesStatus;
    });
  }, [bugs, searchTerm, projectFilter, devFilter, statusFilter]);

  // Reset to page 1 when filters or data change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, projectFilter, devFilter, statusFilter, itemsPerPage, bugs]);

  const totalPages = Math.ceil(filteredBugs.length / itemsPerPage);
  const currentBugs = filteredBugs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getScoreColor = (score: number) => {
    if (score < 10) return dark ? "text-green-400 bg-green-500/10" : "text-green-600 bg-green-50";
    if (score <= 20) return dark ? "text-yellow-400 bg-yellow-500/10" : "text-yellow-600 bg-yellow-50";
    return dark ? "text-red-400 bg-red-500/10" : "text-red-600 bg-red-50";
  };

  const getStatusBadge = (status: string) => {
    const normalized = normalizeStatus(status);
    
    if (normalized === "DONE") {
      return (
        <span className={cn(
          "px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1",
          dark ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-green-100 text-green-700 border border-green-200"
        )}>
          <CheckCircle2 className="w-3 h-3" />
          DONE
        </span>
      );
    }

    if (normalized === "ON PROGRESS") {
      return (
        <span className={cn(
          "px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1",
          dark ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-blue-100 text-blue-700 border border-blue-200"
        )}>
          <Clock className="w-3 h-3" />
          ON PROGRESS
        </span>
      );
    }

    if (normalized === "ON QUEUE") {
      return (
        <span className={cn(
          "px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1",
          dark ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-purple-100 text-purple-700 border border-purple-200"
        )}>
          <Clock className="w-3 h-3" />
          ON QUEUE
        </span>
      );
    }

    if (normalized === "UNMAPPED") {
      return (
        <span className={cn(
          "px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1",
          dark ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-red-100 text-red-700 border border-red-200"
        )}>
          <AlertCircle className="w-3 h-3" />
          UNMAPPED
        </span>
      );
    }

    return (
      <span className={cn(
        "px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1",
        dark ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-amber-100 text-amber-700 border border-amber-200"
      )}>
        <Clock className="w-3 h-3" />
        PENDING
      </span>
    );
  };

  return (
    <div className={cn(
      "rounded-[2rem] shadow-2xl border flex flex-col bg-slate-900 border-slate-800 overflow-hidden",
      !dark && "bg-white border-slate-100",
      className
    )}>
      {/* Tier 1: Internal Search/Filters (Fixed) */}
      {!hideFilters && (
        <div id="data-explorer-header" className={cn(
          "p-4 border-b flex flex-col md:flex-row gap-4 items-center justify-between shrink-0 z-30",
          dark ? "bg-slate-900 border-slate-800 shadow-lg" : "bg-white border-slate-100"
        )}>
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search Project, Developer, or Remarks..."
              className={cn(
                "w-full h-8 pl-11 pr-4 bg-slate-950 border border-slate-800 rounded-lg focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-[11px] text-white placeholder:text-slate-700",
                !dark && "bg-white border-slate-200 text-slate-900 placeholder:text-slate-300"
              )}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center bg-slate-950 border border-slate-800 divide-x divide-slate-800 rounded-lg overflow-hidden">
              <button 
                onClick={() => onExportExcel?.(filteredBugs, "Live-Governance-Ledger")}
                className="flex items-center gap-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all hover:bg-slate-900"
                title="Export Filtered List to Excel"
              >
                <Bug className="w-3 h-3" />
                Excel
              </button>
              <button 
                onClick={() => onExportPDF?.("live-governance-ledger-container", "Live-Governance-Ledger")}
                className="flex items-center gap-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all hover:bg-slate-900"
                title="Export Table to PDF"
              >
                <MoreHorizontal className="w-3 h-3" />
                PDF
              </button>
            </div>

            <select
              className={cn(
                "h-8 px-3 border rounded-lg text-[9px] font-black uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-blue-500/10",
                dark ? "bg-slate-950 border-slate-800 text-slate-400" : "bg-white border-slate-200 text-slate-600"
              )}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statuses.map(s => <option key={s} value={s}>{s} Status</option>)}
            </select>
            <div className="flex items-center gap-2 px-3 h-8 bg-blue-600/5 border border-blue-500/10 rounded-lg">
               <Filter className="w-3 h-3 text-blue-500" />
               <span className="text-[9px] font-black uppercase tracking-widest text-blue-500 shrink-0">{filteredBugs.length} Items</span>
            </div>
          </div>
        </div>
      )}

      {/* Table Body - Scrollable */}
      <div id="live-governance-ledger-container" className="flex-1 overflow-auto scrollbar-hide relative min-h-0">
        <table className="w-full text-left border-collapse min-w-[1600px] table-fixed">
          <thead className="sticky top-0 z-20">
            <tr className={cn(
              "border-b backdrop-blur-md",
              dark ? "bg-slate-900/90 border-slate-800 text-slate-500" : "bg-slate-50/90 border-slate-100 text-slate-500"
            )}>
              <th className="px-6 py-3 text-[9px] font-black uppercase tracking-[0.2em] w-[80px] whitespace-nowrap">No</th>
              <th className="px-6 py-3 text-[9px] font-black uppercase tracking-[0.2em] w-[250px] whitespace-nowrap">Project Mapping</th>
              <th className="px-6 py-3 text-[9px] font-black uppercase tracking-[0.2em] w-[220px] whitespace-nowrap">Developer Identity</th>
              <th className="px-6 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-center w-[120px] whitespace-nowrap">Type</th>
              <th className="px-6 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-center w-[120px] whitespace-nowrap">Severity</th>
              <th className="px-6 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-center w-[100px] whitespace-nowrap">Impact</th>
              <th className="px-6 py-3 text-[9px] font-black uppercase tracking-[0.2em] w-[180px] whitespace-nowrap">SIT Realization</th>
              <th className="px-6 py-3 text-[9px] font-black uppercase tracking-[0.2em] w-[400px] whitespace-nowrap">Dev Status / Remarks</th>
              <th className="px-6 py-3 text-[9px] font-black uppercase tracking-[0.2em] w-[180px] whitespace-nowrap">Last Updated</th>
              <th className="px-6 py-3 text-[9px] font-black uppercase tracking-[0.2em] w-[150px] whitespace-nowrap">Updated By</th>
              <th className="px-6 py-3 text-[9px] font-black uppercase tracking-[0.2em] w-[130px] whitespace-nowrap text-right">Periode</th>
            </tr>
          </thead>
          <tbody className={cn(
            "divide-y",
            dark ? "divide-slate-800/30" : "divide-slate-50"
          )}>
            {currentBugs.map((bug, idx) => {
              const remarksSnippet = bug.remarks && bug.remarks.length > 50 
                ? bug.remarks.substring(0, 50) + "..." 
                : bug.remarks || "No supplementary notes provided";

              return (
                <tr 
                  key={bug.id || `${bug.no}-${idx}`} 
                  onClick={() => setSelectedBug(bug)}
                  className={cn(
                    "transition-colors group align-middle cursor-pointer h-20",
                    dark ? "hover:bg-blue-600/5" : "hover:bg-slate-50/50",
                    idx % 2 === 0 ? "" : (dark ? "bg-slate-800/10" : "bg-slate-50/20")
                  )}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={cn("text-xs font-black", dark ? "text-slate-500 group-hover:text-blue-500" : "text-slate-400 group-hover:text-blue-600")}>
                      {bug.no}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className={cn("font-bold text-xs truncate max-w-[150px]", dark ? "text-white" : "text-slate-900")} title={bug.projectName}>{bug.projectName}</div>
                      <div className="w-px h-3 bg-slate-800 shrink-0" />
                      <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider truncate max-w-[100px]">{bug.sectionName}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className={cn("font-bold text-xs truncate max-w-[120px]", dark ? "text-slate-200" : "text-slate-900")}>{bug.devName}</div>
                      <span className="text-[8px] text-slate-500 font-black uppercase tracking-[0.1em] px-1.5 py-0.5 bg-slate-800/40 rounded border border-slate-700/50">
                        {bug.statusPic}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.15em] inline-block",
                      bug.type === "Bug" 
                        ? (dark ? "text-orange-400 bg-orange-500/10 border border-orange-500/20" : "text-orange-700 bg-orange-50 border border-orange-200")
                        : (dark ? "text-cyan-400 bg-cyan-500/10 border border-cyan-500/20" : "text-cyan-700 bg-cyan-50 border border-cyan-200")
                    )}>
                      {bug.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.15em] inline-block",
                      bug.severity === "Critical" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                      bug.severity === "Major" ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" :
                      bug.severity === "Minor" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                      bug.severity === "Recurring" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                      "bg-slate-800 text-slate-400 border border-slate-700"
                    )}>
                      {bug.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-display font-black text-xs whitespace-nowrap">
                     <div className={cn(
                       "inline-block px-2 py-1 rounded-lg",
                       getScoreColor(bug.bugScore)
                     )}>
                       {bug.bugScore}
                     </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1 justify-center">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">
                        Realized: {bug.sitRealizedDate && bug.sitRealizedDate !== "-" ? (
                          /^\d{4}-\d{2}-\d{2}$/.test(bug.sitRealizedDate) 
                            ? format(new Date(bug.sitRealizedDate), "dd-MMM-yyyy").toUpperCase()
                            : bug.sitRealizedDate
                        ) : "TBA"}
                      </span>
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded inline-block w-fit",
                        bug.includedInFsd === "Ya" 
                          ? (dark ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : "bg-indigo-100 text-indigo-700") 
                          : (dark ? "bg-slate-800 text-slate-600" : "bg-slate-100 text-slate-400")
                      )}>
                        {bug.includedInFsd === "Ya" ? "FSD INCLUDED" : "NO FSD"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3 w-full overflow-hidden">
                      <div className="shrink-0">{getStatusBadge(bug.statusDev)}</div>
                      <div className={cn(
                        "text-[10px] font-medium uppercase tracking-tight opacity-70 group-hover:opacity-100 transition-all truncate",
                        dark ? "text-slate-400" : "text-slate-600"
                      )}>
                        {remarksSnippet}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Clock className="w-3 h-3 text-slate-600" />
                        {bug.last_edited_at ? format(new Date(bug.last_edited_at), "dd-MMM-yyyy") : "SYSTEM"}
                      </div>
                      <div className="text-[9px] font-bold text-slate-500 pl-4.5">
                        {bug.last_edited_at ? format(new Date(bug.last_edited_at), "HH:mm") : "INITIAL"}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                       <User className="w-3 h-3 text-slate-600" />
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight truncate max-w-[120px]">
                         {bug.last_edited_by || "System Bulk Import"}
                       </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-4">
                      <span className="text-[10px] font-black text-slate-500 group-hover:text-blue-500 transition-colors uppercase tracking-[0.2em]">
                        {bug.periode}
                      </span>
                      <motion.div 
                        whileHover={{ scale: 1.1 }}
                        className="p-1.5 bg-slate-800 rounded-md opacity-0 group-hover:opacity-100 transition-all border border-slate-700 shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-500" />
                      </motion.div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tier 3: Pagination Footer (Fixed) */}
      <div className={cn(
        "p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 px-8 bg-slate-900 border-slate-800 shadow-[0_-10px_20px_rgba(0,0,0,0.5)] z-40 sticky bottom-0",
        !dark && "bg-white border-slate-100 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]"
      )}>
        <div className="flex items-center gap-4">
          <div className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] flex items-center gap-2">
            VOLUME: <span className="text-blue-500 font-display text-xs">{filteredBugs.length}</span> ISSUES
          </div>
          <div className="h-4 w-px bg-slate-800/50" />
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">ROWS:</span>
            <select 
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-black px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {[10, 25, 50].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-10 active:scale-90"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
               let pageNum = i + 1;
               if (totalPages > 5 && currentPage > 3) {
                 pageNum = currentPage - 2 + i;
                 if (pageNum > totalPages) pageNum = totalPages - (4 - i);
               }
               if (pageNum < 1) pageNum = i + 1;
               if (pageNum > totalPages) return null;

               return (
                 <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={cn(
                    "w-7 h-7 rounded-lg text-[10px] font-black transition-all",
                    currentPage === pageNum 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30" 
                      : "text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                  )}
                 >
                   {pageNum}
                 </button>
               );
            })}
            {totalPages > 5 && currentPage < totalPages - 2 && (
              <>
                <span className="text-slate-700 px-1"><MoreHorizontal className="w-3 h-3" /></span>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className="w-7 h-7 rounded-lg text-[10px] font-black text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-10 active:scale-90"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedBug && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={cn(
                "w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]",
                !dark && "bg-white border-slate-100"
              )}
            >
              {/* Modal Header */}
              <div className="p-8 pb-6 border-b border-white/5 flex items-start justify-between bg-slate-950/30">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-blue-600/20 border border-blue-500/20 rounded-2xl flex items-center justify-center shrink-0">
                    <Info className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-bold text-white tracking-tight">{selectedBug.projectName}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-blue-500 text-[10px] font-black uppercase tracking-widest">LOG NO: {selectedBug.no}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-700" />
                      <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{selectedBug.sectionName}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isSuperAdmin && !isEditing && (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="p-2.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-xl text-blue-500 transition-all active:scale-95 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                    >
                      <Edit3 className="w-4 h-4" />
                      Adjust Data
                    </button>
                  )}
                  {isEditing && (
                    <button 
                      onClick={handleSaveEdit}
                      disabled={isSaving}
                      className="p-2.5 bg-green-600 hover:bg-green-700 border border-green-500/20 rounded-xl text-white transition-all active:scale-95 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      {isSaving ? <Clock className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {isSaving ? "Persisting..." : "Save Changes"}
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedBug(null)}
                    className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-500 transition-all active:scale-90"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <DetailCap label="Developer" value={selectedBug.devName} icon={<User className="w-3.5 h-3.5" />} color="blue" />
                  <DetailCap label="Type" value={selectedBug.type} icon={<Layers className="w-3.5 h-3.5" />} color={selectedBug.type === 'Bug' ? 'orange' : 'cyan'} />
                  <DetailCap label="Severity" value={selectedBug.severity} icon={<ShieldAlert className="w-3.5 h-3.5" />} color="red" />
                  <DetailCap label="Score" value={String(selectedBug.bugScore)} icon={<CheckCircle2 className="w-3.5 h-3.5" />} color="green" />
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Technical Remarks & Observations</h4>
                  <div className="p-6 bg-slate-950/50 border border-slate-800/50 rounded-2xl">
                    <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                      {selectedBug.remarks || "No supplementary notes provided for this record."}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Infrastructure Metadata</h4>
                    <div className="space-y-2">
                       <MetaRow 
                         label="FSD Included" 
                         value={selectedBug.includedInFsd} 
                         isEditing={isEditing}
                         type="select"
                         options={["Ya", "Tidak"]}
                         editValue={editFields.includedInFsd}
                         onEdit={(val) => setEditFields({ ...editFields, includedInFsd: val })}
                       />
                       <MetaRow label="Testing Type" value={selectedBug.typeTesting} />
                       <MetaRow 
                         label="Discovery Date" 
                         value={selectedBug.discoveryDate} 
                         isEditing={isEditing}
                         type="date"
                         editValue={editFields.discoveryDate}
                         onEdit={(val) => setEditFields({ ...editFields, discoveryDate: val })}
                       />
                       <MetaRow 
                         label="SIT Realization" 
                         value={selectedBug.sitRealizedDate || "Pending"} 
                         isEditing={isEditing}
                         type="date"
                         editValue={editFields.sitRealizedDate}
                         onEdit={(val) => setEditFields({ ...editFields, sitRealizedDate: val })}
                       />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Response & Traceability</h4>
                    <div className="space-y-2">
                       <MetaRow 
                        label="Response Dev" 
                        value={selectedBug.responseDev || "No response recorded"} 
                        isEditing={isEditing}
                        type="select"
                        options={STATUS_OPTIONS}
                        editValue={editFields.responseDev}
                        onEdit={(val) => setEditFields({ ...editFields, responseDev: val })}
                       />
                       <MetaRow 
                        label="Status PIC" 
                        value={selectedBug.statusPic} 
                        isEditing={isEditing}
                        type="select"
                        options={STATUS_OPTIONS}
                        editValue={editFields.statusPic}
                        onEdit={(val) => setEditFields({ ...editFields, statusPic: val })}
                       />
                       <MetaRow 
                        label="Start Date" 
                        value={selectedBug.startDate} 
                        isEditing={isEditing}
                        type="date"
                        editValue={editFields.startDate}
                        onEdit={(val) => setEditFields({ ...editFields, startDate: val })}
                       />
                       <MetaRow 
                        label="Finish Date" 
                        value={selectedBug.finishAt} 
                        isEditing={isEditing}
                        type="date"
                        editValue={editFields.finishAt}
                        onEdit={(val) => setEditFields({ ...editFields, finishAt: val })}
                       />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-8 pt-0 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-3.5 h-3.5 text-slate-600" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        Periode: 
                        {isEditing ? (
                          <select 
                            value={editFields.periode || ""}
                            onChange={(e) => setEditFields({ ...editFields, periode: e.target.value })}
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">— Select Month —</option>
                            {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        ) : (
                          <span className={cn("text-white px-2 py-0.5 rounded", (!selectedBug.periode || selectedBug.periode === "-") && "bg-orange-500/10 text-orange-500 border border-orange-500/20")}>
                            {selectedBug.periode || "NOT SET"}
                            {(!selectedBug.periode || selectedBug.periode === "-") && <AlertCircle className="w-3 h-3 inline ml-1" />}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isEditing ? (
                      <select 
                        value={editFields.statusDev || ""}
                        onChange={(e) => setEditFields({ ...editFields, statusDev: e.target.value })}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      getStatusBadge(selectedBug.statusDev)
                    )}
                  </div>
                </div>

                {/* Audit Metadata Section */}
                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <History className="w-3.5 h-3.5 text-slate-600" />
                       <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Audit Metadata</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-[9px] font-bold text-slate-500">
                        Edited By: <span className="text-slate-300">{selectedBug.last_edited_by || "System Initial"}</span>
                      </div>
                      <div className="text-[9px] font-bold text-slate-500">
                        Last Edited: <span className="text-slate-300">{selectedBug.last_edited_at ? format(new Date(selectedBug.last_edited_at), "dd MMM yyyy, HH:mm") : "N/A"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailCap({ label, value, icon, color }: { label: string, value: string, icon: React.ReactNode, color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    green: "bg-green-500/10 text-green-400 border-green-500/20",
  };

  return (
    <div className={cn("p-3 rounded-2xl border flex flex-col gap-2", colors[color] || "bg-slate-800 border-slate-700 text-slate-400")}>
      <div className="flex items-center gap-2 opacity-60">
        {icon}
        <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-[10px] font-bold truncate tracking-tight">{value}</div>
    </div>
  );
}

function MetaRow({ 
  label, 
  value, 
  isEditing, 
  type = "text", 
  options = [], 
  editValue, 
  onEdit 
}: { 
  label: string;
  value: string;
  isEditing?: boolean;
  type?: "text" | "date" | "select";
  options?: string[];
  editValue?: string;
  onEdit?: (val: string) => void;
}) {
  const isInvalid = !value || value === "-" || value === "Pending" || value === "No response recorded";
  const displayValue = type === "date" && value && /^\d{4}-\d{2}-\d{2}$/.test(value) 
    ? format(new Date(value), "dd-MMM-yyyy").toUpperCase() 
    : (value || "—");

  const renderInput = () => {
    if (type === "select") {
      return (
        <select
          value={editValue || ""}
          onChange={(e) => onEdit?.(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[9px] text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
        >
          <option value="">— Select —</option>
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }
    if (type === "date") {
      return (
        <input
          type="date"
          value={editValue || ""}
          onChange={(e) => onEdit?.(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[9px] text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
        />
      );
    }
    return (
      <input
        type="text"
        value={editValue || ""}
        onChange={(e) => onEdit?.(e.target.value)}
        className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[9px] text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
      />
    );
  };

  return (
    <div className="flex items-center justify-between px-1 min-h-[1.5rem]">
      <span className="text-[9px] font-medium text-slate-600 uppercase tracking-widest shrink-0 w-1/3">{label}</span>
      <div className="flex-1 flex justify-end">
        {isEditing && onEdit ? (
          <div className="w-2/3">{renderInput()}</div>
        ) : (
          <span className={cn(
            "text-[9px] font-bold uppercase tracking-tight",
            isInvalid ? "text-orange-500/60" : "text-slate-400"
          )}>
            {displayValue}
            {isInvalid && <AlertCircle className="w-2.5 h-2.5 inline ml-1 opacity-50" />}
          </span>
        )}
      </div>
    </div>
  );
}

