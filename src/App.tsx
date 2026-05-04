/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { 
  BarChart3, 
  FileDown, 
  LayoutDashboard, 
  PieChart as PieChartIcon, 
  Settings, 
  Users, 
  Download,
  Printer,
  ChevronRight,
  TrendingDown,
  AlertTriangle,
  Bug as BugIcon,
  CheckCircle,
  RefreshCcw,
  Plus,
  Loader2,
  Database,
  Calendar,
  X,
  Search,
  ShieldAlert,
  ChevronLeft,
  TrendingUp,
  LogOut
} from "lucide-react";
import { BugRecord, DevStats, SEVERITY_WEIGHTS, DevEvaluation, AppUser } from "./types";
import { ExcelImport } from "./components/ExcelImport";
import { DashboardCharts } from "./components/Charts";
import { DataTable } from "./components/DataTable";
import { Leaderboard } from "./components/Leaderboard";
import { GlobalControls } from "./components/GlobalControls";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { format, subMonths, isAfter, isBefore, parse } from "date-fns";
import { Login } from "./components/Login";
import { cn } from "./lib/utils";
import { normalizeStatus, isPeriodeMissing } from "./lib/normalization";

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [bugs, setBugs] = useState<BugRecord[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "leaderboard" | "data" | "controls">("overview");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [drilldownType, setDrilldownType] = useState<"all" | "bugs" | "score" | "missing" | "unmapped" | null>(null);
  const [projectInput, setProjectInput] = useState("");
  const [devInput, setDevInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const uniqueProjects = useMemo(() => Array.from(new Set(bugs.map(b => b.projectName))).filter(Boolean), [bugs]);
  const uniqueDevs = useMemo(() => Array.from(new Set(bugs.map(b => b.devName))).filter(Boolean), [bugs]);
  const [selectedDev, setSelectedDev] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  
  const [startPeriode, setStartPeriode] = useState<string>("");
  const [endPeriode, setEndPeriode] = useState<string>("");
  const [showIntegrityOnly, setShowIntegrityOnly] = useState<"none" | "missing_period" | "unmapped_status">("none");

  useEffect(() => {
    const savedUser = localStorage.getItem("wisesa_user");
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    setAuthLoading(false);
  }, []);

  const handleLogin = (user: AppUser) => {
    setCurrentUser(user);
    localStorage.setItem("wisesa_user", JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("wisesa_user");
  };

  // Fetch data on load
  const loadData = async () => {
    if (!isSupabaseConfigured || !currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Fetch Bugs
      const { data: bugData, error: bugError } = await supabase
        .from('bugs')
        .select('*')
        .order('discoveryDate', { ascending: false });

      if (bugError) {
        if (bugError.code === 'PGRST204' || bugError.code === 'PGRST205') {
          throw new Error(`Table 'bugs' not found in public schema. Please verify your Supabase database structure.`);
        }
        throw bugError;
      }

      // Fetch Evaluations
      const { data: evalData, error: evalError } = await supabase
        .from('dev_evaluations')
        .select('*');

      if (!evalError && evalData) {
        const evalMap: Record<string, string> = {};
        evalData.forEach((e: any) => evalMap[e.dev_name] = e.notes);
        setEvaluations(evalMap);
      }

      if (bugData) {
        setBugs(bugData as BugRecord[]);
        setLastSync(new Date().toLocaleTimeString());
      }
    } catch (err: any) {
      console.error("Error loading data:", err);
      setError(err.message || "Failed to connect to governance database.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveIntegrity = async (id: string, field: 'periode' | 'statusDev', value: string) => {
    try {
      const { error } = await supabase
        .from('bugs')
        .update({ [field]: value })
        .eq('id', id);
      
      if (error) throw error;
      loadData();
    } catch (err: any) {
      alert("Persistence Failure: " + err.message);
    }
  };

  const getPeriodeValue = (s: string) => {
    if (!s) return 0;
    // Handle MMM-yyyy or MMM yyyy or MMM-yy
    const parts = s.includes('-') ? s.split('-') : s.split(' ');
    if (parts.length === 2) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mIdx = months.findIndex(m => m.toLowerCase().startsWith(parts[0].toLowerCase().substring(0, 3)));
      let year = parseInt(parts[1]);
      if (parts[1].length === 2) year += 2000; // Handle yy format
      if (!isNaN(year) && mIdx !== -1) {
        return (year * 12) + mIdx;
      }
    }
    const num = parseInt(s);
    return isNaN(num) ? 0 : num;
  };

  // Get unique periodes for selection
  const uniquePeriodes = useMemo(() => {
    const p = Array.from(new Set(bugs.map(b => b.periode))).filter((b): b is string => !!b);
    return p.sort((a, b) => getPeriodeValue(a) - getPeriodeValue(b));
  }, [bugs]);

  // Default filters on load
  useEffect(() => {
    if (uniquePeriodes.length > 0 && !startPeriode) {
      // Set default to last month and current month
      const monthsToShow = 2;
      setStartPeriode(uniquePeriodes[Math.max(0, uniquePeriodes.length - monthsToShow)]);
      setEndPeriode(uniquePeriodes[uniquePeriodes.length - 1]);
    }
  }, [uniquePeriodes]);

  const filteredBugs = useMemo(() => {
    return bugs.filter(bug => {
      if (showIntegrityOnly === "missing_period") return isPeriodeMissing(bug.periode);
      if (showIntegrityOnly === "unmapped_status") return normalizeStatus(bug.statusDev) === "UNMAPPED";

      const matchesSeverity = severityFilter === "All" || bug.severity === severityFilter;
      const matchesType = typeFilter === "All" || bug.type === typeFilter;
      const matchesProject = projectInput === "" || bug.projectName?.toLowerCase().includes(projectInput.toLowerCase());
      const matchesDev = devInput === "" || bug.devName?.toLowerCase().includes(devInput.toLowerCase());
      
      const consolidatedStatus = normalizeStatus(bug.statusDev);
      
      let matchesStatus = statusFilter === "All" || consolidatedStatus === statusFilter;
      if (statusFilter === "UNMAPPED") matchesStatus = consolidatedStatus === "UNMAPPED";

      const smartSearch = searchTerm.toLowerCase();
      const matchesSearch = searchTerm === "" || 
        bug.projectName?.toLowerCase().includes(smartSearch) || 
        bug.devName?.toLowerCase().includes(smartSearch) || 
        bug.remarks?.toLowerCase().includes(smartSearch);
      
      const bugVal = getPeriodeValue(bug.periode);
      const startVal = startPeriode ? getPeriodeValue(startPeriode) : -1;
      const endVal = endPeriode ? getPeriodeValue(endPeriode) : 9999999;
      
      let matchesPeriode = bugVal >= startVal && bugVal <= endVal;
      if (startPeriode === "MISSING") matchesPeriode = isPeriodeMissing(bug.periode);

      return matchesSeverity && matchesType && matchesPeriode && matchesProject && matchesDev && matchesStatus && matchesSearch;
    });
  }, [bugs, severityFilter, typeFilter, startPeriode, endPeriode, projectInput, devInput, statusFilter, searchTerm, showIntegrityOnly]);

  const [error, setError] = useState<string | null>(null);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [profiles, setProfiles] = useState<AppUser[]>([]);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const fetchProfiles = async () => {
    if (currentUser?.role !== "super_admin") return;
    const { data, error } = await supabase.from("profiles").select("*");
    if (!error && data) setProfiles(data);
  };

  const createProfile = async (userData: Partial<AppUser>) => {
    try {
      const { data, error } = await supabase.from("profiles").insert([userData]).select();
      if (error) throw error;
      fetchProfiles();
    } catch (err: any) {
      alert("Creation Failed: " + err.message);
    }
  };

  const updateProfile = async (user: AppUser) => {
    try {
      const { error } = await supabase.from("profiles").update(user).eq("id", user.id);
      if (error) throw error;
      fetchProfiles();
    } catch (err: any) {
      alert("Update Failed: " + err.message);
    }
  };

  const deleteProfile = async (id: string) => {
    if (!confirm("Permanently revoke analyst access?")) return;
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (!error) fetchProfiles();
  };

  useEffect(() => {
    if (activeTab === "controls") {
      fetchProfiles();
    }
  }, [activeTab]);

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  const devStats = useMemo(() => {
    const stats: Record<string, DevStats> = {};
    
    filteredBugs.forEach((bug) => {
      const dev = bug.devName || "Unknown";
      if (!stats[dev]) {
        stats[dev] = {
          devName: dev,
          totalScore: 0,
          bugCount: 0,
          criticalCount: 0,
          majorCount: 0,
          minorCount: 0,
          triviaCount: 0,
          recurringCount: 0,
          evaluationNotes: evaluations[dev] || ""
        };
      }
      
      if (bug.type === 'Bug') {
        stats[dev].bugCount += 1;
      }
      stats[dev].totalScore += (bug.bugScore || 0);
      
      const severity = bug.severity || "";
      if (severity === "Critical") stats[dev].criticalCount += 1;
      else if (severity === "Major") stats[dev].majorCount += 1;
      else if (severity === "Minor") stats[dev].minorCount += 1;
      else if (severity === "Trivia") stats[dev].triviaCount += 1;
      else if (severity === "Recurring") stats[dev].recurringCount += 1;
    });

    // PUNTISHMENT LOGIC: Sort by Highest Score first
    return Object.values(stats).sort((a, b) => b.totalScore - a.totalScore);
  }, [filteredBugs, evaluations]);

  const totalFilteredScore = filteredBugs.reduce((sum, b) => sum + b.bugScore, 0);
  const openBugsCount = filteredBugs.filter(b => b.statusDev === "Open" || b.statusDev === "Reopen").length;
  
  const missingPeriodsCount = useMemo(() => bugs.filter(b => isPeriodeMissing(b.periode)).length, [bugs]);
  const unmappedStatusCount = useMemo(() => bugs.filter(b => normalizeStatus(b.statusDev) === "UNMAPPED").length, [bugs]);

  const bugsCount = filteredBugs.filter(b => b.type === "Bug").length;
  const crCount = filteredBugs.filter(b => b.type === "Change Request").length;
  const sitTotalVolume = bugsCount + crCount;
  const topOffender = devStats.length > 0 ? devStats[0].devName : "N/A";

  const exportToExcel = () => {
    // Export ONLY filtered data
    const ws = XLSX.utils.json_to_sheet(filteredBugs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Filtered Bug Data");
    XLSX.writeFile(wb, `BugTracker-Filtered-Report-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = async () => {
    const element = document.getElementById("dashboard-content");
    if (!element) return;

    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Executive-Summary-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const addManualRecord = async (newBug: Partial<BugRecord>) => {
    if (!isSupabaseConfigured) {
      setBugs([newBug as BugRecord, ...bugs]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('bugs')
        .insert([newBug])
        .select();

      if (error) throw error;
      if (data) {
        setBugs([data[0] as BugRecord, ...bugs]);
      }
    } catch (err) {
      console.error("Error adding record:", err);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex text-slate-100 font-sans bg-slate-950 max-h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "bg-slate-900 text-slate-400 flex flex-col fixed h-full shrink-0 z-20 border-r border-slate-800 transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "w-20" : "w-72"
      )}>
        <div className={cn("p-8 transition-all", isSidebarCollapsed && "px-4")}>
          <div className="flex items-center gap-3 text-white mb-10 overflow-hidden">
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-900/30 ring-4 ring-blue-600/10 shrink-0">
              <BugIcon className="w-6 h-6" />
            </div>
            {!isSidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="whitespace-nowrap"
              >
                <span className="font-display font-bold text-xl tracking-tight block">Wisesa BugTracker</span>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">V1.0</span>
              </motion.div>
            )}
            {isSidebarCollapsed && (
              <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest absolute top-20 left-1/2 -translate-x-1/2">v1.0</div>
            )}
          </div>

          <nav className="space-y-2">
            <NavItem 
              active={activeTab === "overview"} 
              onClick={() => setActiveTab("overview")} 
              icon={<BarChart3 />} 
              label="Executive Overview" 
              collapsed={isSidebarCollapsed}
            />
            <NavItem 
              active={activeTab === "leaderboard"} 
              onClick={() => setActiveTab("leaderboard")} 
              icon={<Users />} 
              label="Quality Leaderboard" 
              collapsed={isSidebarCollapsed}
            />
            <NavItem 
              active={activeTab === "data"} 
              onClick={() => setActiveTab("data")} 
              icon={<FileDown />} 
              label="Data Explorer" 
              collapsed={isSidebarCollapsed}
            />
            {currentUser.role === "super_admin" && (
              <NavItem 
                active={activeTab === "controls"} 
                onClick={() => setActiveTab("controls")} 
                icon={<Settings />} 
                label="Global Controls" 
                collapsed={isSidebarCollapsed}
              />
            )}
          </nav>
        </div>

        <div className="mt-auto p-4 space-y-4">
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="w-full h-10 flex items-center justify-center bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl transition-all text-slate-500 hover:text-white group relative"
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!isSidebarCollapsed && <span className="ml-2 text-[10px] font-black uppercase tracking-widest">Collapse View</span>}
          </button>

          <div className={cn(
            "bg-slate-950 border border-slate-800 rounded-3xl relative overflow-hidden group transition-all",
            isSidebarCollapsed ? "p-3 flex justify-center" : "p-5"
          )}>
            <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
               <div className="w-12 h-12 bg-blue-600 rounded-full blur-2xl" />
            </div>
            
            {isSidebarCollapsed ? (
              <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-white font-bold text-[10px]">
                {currentUser.full_name?.[0] || currentUser.email[0]}
              </div>
            ) : (
              <>
                <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
                  Active Session
                </div>
                <div className="text-white font-bold text-xs truncate max-w-full mb-1">
                  {currentUser.full_name || currentUser.email}
                </div>
                <div className="text-blue-500 text-[10px] font-black uppercase tracking-widest mb-4">
                  {currentUser.role === "super_admin" ? "Super Administrator" : "Standard Admin"}
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-full bg-slate-900 border border-slate-800 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                >
                  Terminate Session
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 flex flex-col h-screen bg-slate-950 relative overflow-hidden transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "ml-20" : "ml-72"
      )}>
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
        
        {/* LOCKED EXECUTIVE HEADER (Sticky) */}
        <header className="sticky top-0 z-[100] bg-slate-950 border-b border-white/5 px-8 pt-8 pb-4 shrink-0 shadow-2xl">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-display font-bold text-white tracking-tight flex items-center gap-3">
                  Wisesa BugTracker Pro
                  <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-black text-blue-500 uppercase tracking-widest">v1.0</span>
                </h1>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">SIT Governance & Data Quality Command Center</p>
              </div>

              <div className="flex items-center gap-3">
                <ExcelImport variant="compact" onDataLoaded={() => loadData()} />
                <button 
                  onClick={() => setIsManualModalOpen(true)}
                  className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {activeTab === "overview" && (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4 shrink-0 px-8 mb-6">
                <StatCard 
                  title="Grand Total SIT" 
                  value={sitTotalVolume} 
                  icon={<Database />}
                  color="blue"
                  onClick={() => setDrilldownType("all")}
                  clickable
                  isPrimary
                />
                <StatCard 
                  title="Detect Defects" 
                  value={bugsCount} 
                  icon={<BugIcon />}
                  color="orange"
                  onClick={() => setDrilldownType("bugs")}
                  clickable
                />
                <StatCard 
                  title="Penalty Score" 
                  value={totalFilteredScore.toFixed(1)} 
                  icon={<TrendingDown />}
                  color="red"
                  onClick={() => setDrilldownType("score")}
                  clickable
                />
                <StatCard 
                  title="Orphaned" 
                  value={missingPeriodsCount} 
                  icon={<Calendar />}
                  color="red"
                  onClick={() => setDrilldownType("missing")}
                  clickable
                />
                <StatCard 
                  title="Unmapped" 
                  value={unmappedStatusCount} 
                  icon={<AlertTriangle />}
                  color="amber"
                  onClick={() => setDrilldownType("unmapped")}
                  clickable
                />
                <StatCard 
                  title="Top Risk" 
                  value={topOffender.split(' ')[0] || "N/A"} 
                  icon={<Users />}
                  color="purple"
                  onClick={() => {
                    const offender = devStats[0];
                    if (offender) setSelectedDev(offender.devName);
                  }}
                  clickable
                />
              </div>
            )}

            {/* INTEGRATED FILTER BAR (Sticky) */}
            <div className="px-8 mb-4 shrink-0">
              <div className="grid grid-cols-12 gap-4 items-center bg-slate-900/40 p-2 rounded-2xl border border-white/5 shadow-inner">
              <div className="col-span-5 flex items-center gap-3 pl-3">
                <Search className="w-4 h-4 text-slate-600 shrink-0" />
                <input 
                  type="text" 
                  placeholder="Smart search (Projects, Devs, Remarks)..."
                  className="bg-transparent border-none focus:ring-0 text-xs text-white w-full placeholder:text-slate-700 font-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="col-span-1 flex justify-center">
                <div className="h-6 w-px bg-slate-800" />
              </div>

              <div className="col-span-6 flex items-center justify-end gap-4 pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Type:</span>
                  <select 
                    value={typeFilter} 
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-white text-[10px] focus:ring-1 focus:ring-blue-500/30 font-bold"
                  >
                    <option value="All">All Types</option>
                    <option value="Bug">Defects</option>
                    <option value="Change Request">Requests</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Severity:</span>
                  <select 
                    value={severityFilter} 
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-white text-[10px] focus:ring-1 focus:ring-blue-500/30 font-bold"
                  >
                    <option value="All">All Impact</option>
                    {Object.keys(SEVERITY_WEIGHTS).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Month:</span>
                  <select 
                    value={startPeriode} 
                    onChange={(e) => setStartPeriode(e.target.value)}
                    className={cn(
                      "bg-slate-950 border rounded-lg px-2 py-1.5 text-white text-[10px] font-bold",
                      startPeriode === "MISSING" ? "border-red-500 text-red-500" : "border-slate-800"
                    )}
                  >
                    <option value="">Select Period</option>
                    <option value="MISSING" className="text-red-500">ORPHANED</option>
                    {uniquePeriodes.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                {(searchTerm || typeFilter !== "All" || severityFilter !== "All" || statusFilter !== "All" || startPeriode) && (
                  <button 
                    onClick={() => {
                      setSearchTerm("");
                      setTypeFilter("All");
                      setSeverityFilter("All");
                      setStatusFilter("All");
                      setStartPeriode("");
                    }}
                    className="p-2 text-slate-500 hover:text-red-500 transition-colors"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center flex-1">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">Governance Sync in Progress...</p>
          </div>
        ) : error ? (
          <div className="flex-1 overflow-y-auto p-10 pt-0 scrollbar-hide">
            <div className="flex flex-col items-center justify-center min-h-full max-w-2xl mx-auto text-center px-6">
              <div className="bg-red-500/5 p-6 rounded-[2.5rem] border border-red-500/20 mb-8 w-full">
                <Database className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-display font-bold text-red-500 mb-2">Supabase Schema Error</h2>
                <p className="text-red-400 text-sm leading-relaxed mb-6">
                  {error}
                </p>
                <div className="text-left bg-slate-900 p-6 rounded-2xl overflow-x-auto border border-slate-800">
                  <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-3">Required SQL Schema Fix:</p>
                  <code className="text-slate-400 text-xs font-mono leading-relaxed whitespace-pre">
{`CREATE TABLE public.bugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  no TEXT,
  "sectionName" TEXT,
  "projectName" TEXT,
  "typeTesting" TEXT,
  "discoveryDate" TEXT,
  type TEXT,
  severity TEXT,
  "includedInFsd" TEXT,
  remarks TEXT,
  screenshot TEXT,
  "statusPic" TEXT,
  "devName" TEXT,
  "startDate" TEXT,
  "finishAt" TEXT,
  "responseDev" TEXT,
  "statusDev" TEXT,
  "sitRealizedDate" TEXT,
  periode TEXT,
  "bugScore" NUMERIC DEFAULT 0,
  "total_score" NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  password TEXT,
  role TEXT DEFAULT 'admin',
  full_name TEXT
);

-- Enable RLS
ALTER TABLE public.bugs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access" ON public.bugs FOR ALL USING (true);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);`}
                  </code>
                </div>
                <button 
                  onClick={() => loadData()}
                  className="mt-8 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-red-900/40 active:scale-95 flex items-center gap-2 mx-auto"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Retry Connection
                </button>
              </div>
            </div>
          </div>
        ) : bugs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-xl w-full px-6"
            >
              <ExcelImport variant="card" onDataLoaded={() => loadData()} />
            </motion.div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
            <AnimatePresence mode="wait">
              {activeTab === "overview" && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col min-h-0 overflow-hidden"
                >
                  <div id="dashboard-content" className="flex-1 flex flex-col min-h-0 px-8 pb-4 space-y-6 overflow-y-auto scrollbar-hide">
                    <DashboardCharts devStats={devStats} allBugs={filteredBugs} selectedSeverity={severityFilter} />
                    
                    <div className="flex flex-col flex-grow min-h-[600px]">
                      <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-xl font-display font-bold text-white tracking-tight flex items-center gap-2">
                          <Database className="w-5 h-5 text-blue-500" />
                          Live Governance Ledger
                        </h2>
                        <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">SIT Transaction Feed</div>
                      </div>
                      <DataTable bugs={filteredBugs} dark className="flex-1 rounded-3xl border border-white/5 overflow-hidden shadow-2xl" />
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "leaderboard" && (
                <motion.div
                  key="leaderboard"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 overflow-hidden flex flex-col px-8 pt-0 pb-8"
                >
                   <Leaderboard 
                    devStats={devStats.sort((a, b) => b.totalScore - a.totalScore)} 
                    lastSync={lastSync}
                    onDevClick={(dev) => setSelectedDev(dev)}
                  />
                </motion.div>
              )}

              {activeTab === "data" && (
                <motion.div
                  key="data"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 px-8 pt-0 pb-8 flex flex-col overflow-hidden"
                >
                  <DataTable bugs={filteredBugs} dark className="flex-1 rounded-3xl border border-white/5 overflow-hidden shadow-2xl" />
                </motion.div>
              )}

              {activeTab === "controls" && currentUser?.role === "super_admin" && (
                <motion.div
                  key="controls"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 px-8 pt-0 pb-8 overflow-hidden flex flex-col"
                >
                  <GlobalControls 
                    profiles={profiles} 
                    onDelete={deleteProfile} 
                    onCreate={createProfile}
                    onUpdate={updateProfile}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="mt-auto px-8 pb-8 pt-4 flex items-center justify-between border-t border-white/5 bg-slate-950 shrink-0">
              <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-500" />
                Operational Consistency Ledger • Secure Instance
              </div>
              
              <button 
                onClick={async () => {
                  if (confirm("DANGER: This will permanently wipe all bug records. Continue?")) {
                    const { error } = await supabase.from('bugs').delete().neq('no', 'RESERVED_SYSTEM_ID');
                    if (!error) loadData();
                  }
                }}
                className="flex items-center gap-2 text-red-500 hover:text-red-400 transition-all text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-red-500/5 rounded-xl border border-red-500/10"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Flush Audit Hub
              </button>
            </div>
          </div>
        )
      }
    </main>

    {/* Modals are handled below main content */}
    <AnimatePresence>
      {drilldownType && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-slate-900 w-[95vw] h-[90vh] rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 shrink-0">
              <div>
                <h2 className="text-3xl font-display font-bold text-white tracking-tight">
                  {drilldownType === "all" && "SIT Global Ledger"}
                  {drilldownType === "bugs" && "Defect Audit Trail"}
                  {drilldownType === "score" && "Governance Quality Audit"}
                  {drilldownType === "missing" && "Orphaned Records Audit"}
                  {drilldownType === "unmapped" && "Normalization Failure Audit"}
                </h2>
                <p className="text-slate-500 text-[10px] mt-1 uppercase font-black tracking-widest">
                  KPI Drill-down Terminal • Access Level: Master superadmin
                </p>
              </div>
              <button 
                onClick={() => setDrilldownType(null)}
                className="p-3 bg-slate-700 hover:bg-slate-600 rounded-2xl transition-colors text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 min-h-0 bg-slate-950 p-0 flex flex-col">
              <DataTable 
                bugs={
                  drilldownType === "all" ? bugs :
                  drilldownType === "bugs" ? bugs.filter(b => b.type === "Bug") :
                  drilldownType === "score" ? bugs.filter(b => b.bugScore > 0) :
                  drilldownType === "missing" ? bugs.filter(b => isPeriodeMissing(b.periode)) :
                  drilldownType === "unmapped" ? bugs.filter(b => normalizeStatus(b.statusDev) === "UNMAPPED") :
                  []
                } 
                dark 
                hideFilters
                className="flex-1 rounded-none border-0"
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    <AnimatePresence>
      {selectedDev && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-slate-900 w-[95vw] h-[90vh] rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 shrink-0">
              <div>
                <h2 className="text-3xl font-display font-bold text-white tracking-tight">Detail Issues: {selectedDev}</h2>
                <p className="text-slate-500 text-[10px] mt-1 uppercase font-black tracking-widest">Incident History Drill-down • Access Level: Master superadmin</p>
              </div>
              <button 
                onClick={() => setSelectedDev(null)}
                className="p-3 bg-slate-700 hover:bg-slate-600 rounded-2xl transition-colors text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 min-h-0 bg-slate-950 p-0 flex flex-col">
              <DataTable 
                bugs={filteredBugs.filter(b => b.devName === selectedDev)} 
                dark 
                hideFilters
                className="flex-1 rounded-none border-0"
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    <AnimatePresence>
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-slate-900 w-full max-w-4xl rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="bg-slate-950 p-8 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
              <div>
                <h2 className="text-2xl font-display font-bold tracking-tight">Manual Bug Log Entry</h2>
                <p className="text-slate-500 text-sm mt-1 font-medium">Capture SIT issues directly into database</p>
              </div>
              <button 
                onClick={() => setIsManualModalOpen(false)}
                className="w-12 h-12 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-2xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form className="p-10 space-y-8 overflow-y-auto" onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const sev = formData.get("severity") as string;
              
              const newBug: Partial<BugRecord> = {
                no: `MAN-${Date.now().toString().slice(-6)}`,
                sectionName: formData.get("sectionName") as string,
                projectName: formData.get("projectName") as string,
                typeTesting: formData.get("typeTesting") as string,
                discoveryDate: format(new Date(), "dd-MMM-yy"),
                type: formData.get("type") as string,
                severity: sev,
                includedInFsd: formData.get("includedInFsd") as string,
                remarks: formData.get("remarks") as string,
                screenshot: "",
                statusPic: formData.get("statusPic") as string,
                devName: formData.get("devName") as string,
                startDate: formData.get("startDate") as string,
                finishAt: formData.get("finishAt") as string,
                responseDev: formData.get("responseDev") as string,
                statusDev: formData.get("statusDev") as string,
                sitRealizedDate: formData.get("sitRealizedDate") as string,
                periode: formData.get("periode") as string,
                bugScore: SEVERITY_WEIGHTS[sev] || 0,
                total_score: SEVERITY_WEIGHTS[sev] || 0,
              };
              addManualRecord(newBug);
              setIsManualModalOpen(false);
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
                 <InputField label="Project Name" name="projectName" required placeholder="e.g. Lending Core" list="projects-dl" />
                 <InputField label="Developer" name="devName" required placeholder="John Doe" list="devs-dl" />
                 <datalist id="projects-dl">
                    {uniqueProjects.map(p => <option key={p} value={p} />)}
                 </datalist>
                 <datalist id="devs-dl">
                    {uniqueDevs.map(d => <option key={d} value={d} />)}
                 </datalist>
                 <SelectField label="Severity" name="severity">
                    {Object.keys(SEVERITY_WEIGHTS).map(s => <option key={s} value={s}>{s}</option>)}
                 </SelectField>
                 <InputField label="Section" name="sectionName" placeholder="e.g. API Gateway" />
                 <InputField label="Type Testing" name="typeTesting" placeholder="e.g. SIT" />
                 <SelectField label="Type" name="type">
                    <option value="Bug">Bug</option>
                    <option value="Change Request">Change Request</option>
                 </SelectField>
                 <InputField label="Periode" name="periode" required placeholder="e.g. Jan 2026" />
                 <SelectField label="Included in FSD" name="includedInFsd">
                    <option value="Tidak">Tidak</option>
                    <option value="Ya">Ya</option>
                 </SelectField>
                 <InputField label="Status PIC" name="statusPic" placeholder="e.g. In Review" />
                 <InputField label="Start Date" name="startDate" type="date" />
                 <InputField label="Finish Date" name="finishAt" type="date" />
                 <InputField label="SIT Realized Date" name="sitRealizedDate" type="date" />
                 <InputField label="Status Dev" name="statusDev" placeholder="e.g. Fixed" />
                 <InputField label="Response Dev" name="responseDev" className="lg:col-span-2" placeholder="Dev notes..." />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Detailed Remarks</label>
                <textarea name="remarks" required rows={3} className="w-full px-6 py-4 border border-slate-800 rounded-3xl focus:ring-4 focus:ring-blue-500/10 bg-slate-950 transition-all outline-none text-white" placeholder="Elaborate on the defect..." />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsManualModalOpen(false)} className="flex-1 h-10 rounded-xl font-black uppercase tracking-widest bg-slate-800 text-slate-500 hover:bg-slate-700 transition-all text-[10px]">Discard</button>
                <button type="submit" className="flex-[2] h-10 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] text-[10px]">
                  Commit Record
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

      {/* User Creation Modal */}
      <AnimatePresence>
        {isCreatingUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 w-full max-w-md rounded-[2rem] border border-slate-800 shadow-2xl p-10"
            >
              <h2 className="text-2xl font-display font-bold text-white mb-1">Initialize Analyst</h2>
              <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest mb-8">Grant Terminal Access</p>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const { error } = await supabase.from("profiles").insert([{
                  full_name: fd.get("full_name"),
                  email: fd.get("email"),
                  password: fd.get("password"),
                  role: fd.get("role")
                }]);
                if (!error) {
                  setIsCreatingUser(false);
                  fetchProfiles();
                } else {
                  alert(error.message);
                }
              }} className="space-y-4">
                <InputField label="Full Name" name="full_name" required placeholder="Display Identity" />
                <InputField label="Email Address" name="email" type="email" required placeholder="auth@wisesa.id" />
                <InputField label="Security Key" name="password" type="password" required placeholder="••••••••" />
                <SelectField label="Access Level" name="role">
                  <option value="admin">Standard Analyst</option>
                  <option value="super_admin">Master Superadmin</option>
                </SelectField>

                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setIsCreatingUser(false)} className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Discard</button>
                  <button type="submit" className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all">Authorize Profile</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 w-full max-w-md rounded-[2rem] border border-slate-800 shadow-2xl p-10"
            >
              <h2 className="text-2xl font-display font-bold text-white mb-1">Modify Access</h2>
              <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest mb-8">Update Security Identity</p>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const { error } = await supabase.from("profiles").update({
                  full_name: fd.get("full_name"),
                  password: fd.get("password"),
                  role: fd.get("role")
                }).eq("id", editingUser.id);
                
                if (!error) {
                  setEditingUser(null);
                  fetchProfiles();
                } else {
                  alert(error.message);
                }
              }} className="space-y-4">
                <InputField label="Full Name" name="full_name" required defaultValue={editingUser.full_name} />
                <div className="space-y-1.5 opacity-50">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Email (Immutable)</label>
                   <div className="w-full px-5 h-11 border border-slate-800 rounded-xl bg-slate-800/20 text-slate-400 text-sm flex items-center">{editingUser.email}</div>
                </div>
                <InputField label="Security Key" name="password" type="password" required defaultValue={editingUser.password} />
                <SelectField label="Access Level" name="role" defaultValue={editingUser.role}>
                  <option value="admin">Standard Analyst</option>
                  <option value="super_admin">Master Superadmin</option>
                </SelectField>

                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Abort</button>
                  <button type="submit" className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all">Update Identity</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string, onClear: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg">
      <span className="text-[9px] font-bold text-blue-400 whitespace-nowrap uppercase tracking-tight">{label}</span>
      <button 
        onClick={onClear}
        className="hover:text-white text-blue-500/50 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function NavItem({ active, onClick, icon, label, collapsed }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, collapsed?: boolean }) {
  return (
    <button 
      onClick={onClick}
      title={collapsed ? label : ""}
      className={cn(
        "w-full flex items-center gap-4 rounded-2xl transition-all relative group h-12 shrink-0",
        active ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" : "hover:bg-white/5 text-slate-400 hover:text-slate-200",
        collapsed ? "px-0 justify-center" : "px-5"
      )}
    >
      <div className="shrink-0 flex items-center justify-center">
        {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}
      </div>
      {!collapsed && (
        <span className="font-semibold text-sm whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
      )}
      {active && !collapsed && (
        <motion.div 
          layoutId="nav-pill"
          className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white" 
        />
      )}
    </button>
  );
}

function StatCard({ title, value, icon, color, isPrimary, onClick, clickable }: { title: string, value: string | number, icon: React.ReactNode, color: string, isPrimary?: boolean, onClick?: () => void, clickable?: boolean }) {
  const colorMap: Record<string, string> = {
    red: "text-red-500",
    orange: "text-orange-500",
    blue: "text-blue-500",
    purple: "text-purple-500",
    green: "text-green-500",
    amber: "text-amber-500",
  };

  return (
    <motion.div 
      whileHover={clickable ? { y: -5, scale: 1.02 } : { y: -2 }}
      whileTap={clickable ? { scale: 0.98 } : {}}
      onClick={onClick}
      className={cn(
        "bg-slate-900 border border-slate-800 transition-all group relative overflow-hidden flex flex-col h-full",
        "p-5 rounded-[1.5rem]",
        isPrimary && "ring-2 ring-blue-500/20 shadow-xl shadow-blue-500/5",
        clickable ? "cursor-pointer hover:border-blue-500/40 hover:shadow-2xl hover:shadow-blue-900/10" : "hover:border-slate-700"
      )}
    >
      <div className="flex items-center gap-3 mb-auto">
        <div className={cn(
          "p-2 rounded-lg bg-slate-800 transition-colors shadow-inner",
          colorMap[color],
          clickable && "group-hover:bg-blue-500/10"
        )}>
          {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4" })}
        </div>
        <h4 className="text-slate-500 text-[8px] font-black uppercase tracking-[0.15em]">{title}</h4>
      </div>
      
      <div className="mt-4">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-display font-black text-white leading-none tracking-tight">{value}</span>
        </div>
      </div>
    </motion.div>
  );
}

function InputField({ label, name, required, placeholder, type = "text", className = "", list }: any) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">{label}</label>
      <input 
        name={name} 
        required={required} 
        type={type}
        list={list}
        className="w-full px-5 h-11 border border-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/10 bg-slate-950 transition-all outline-none text-white text-sm font-medium placeholder:text-slate-700" 
        placeholder={placeholder} 
      />
    </div>
  );
}

function SelectField({ label, name, children }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">{label}</label>
      <select 
        name={name} 
        className="w-full px-5 h-11 border border-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/10 bg-slate-950 transition-all outline-none text-white text-sm font-medium appearance-none"
      >
        {children}
      </select>
    </div>
  );
}

function AdminCommand({ label, sub, onClick, isAlert }: { label: string, sub: string, onClick: () => void, isAlert?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center justify-between p-5 bg-slate-950/50 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-all text-left group",
        isAlert && "border-red-500/30 bg-red-500/5"
      )}
    >
      <div>
        <div className="text-sm font-bold text-slate-200">{label}</div>
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-1">{sub}</div>
      </div>
      <ChevronRight className={cn("w-4 h-4 text-slate-600 group-hover:text-blue-500 transition-colors", isAlert && "text-red-500")} />
    </button>
  );
}

function DataIntegrityList({ title, icon, bugs, type, onSave }: { title: string, icon: React.ReactNode, bugs: BugRecord[], type: 'periode' | 'status', onSave: (id: string, val: string) => void }) {
  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden min-h-[300px]">
      <div className="p-6 border-b border-slate-800 flex items-center gap-3 bg-slate-950/30">
        {icon}
        <h3 className="font-display font-bold text-lg text-white">{title}</h3>
        <span className="ml-auto text-[10px] font-black bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full uppercase tracking-widest">{bugs.length} Issues</span>
      </div>
      <div className="flex-1 overflow-y-auto p-0 scrollbar-hide">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-500 tracking-widest">No</th>
              <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-500 tracking-widest">Project</th>
              <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-500 tracking-widest">Dev</th>
              <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-500 tracking-widest">Quick Fix</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/20">
            {bugs.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-10 text-center text-slate-600 font-bold uppercase text-[10px] tracking-[0.2em]">All Systems Nominal</td>
              </tr>
            ) : (
              bugs.map(bug => (
                <tr key={bug.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-4 py-3 font-mono text-blue-500">{bug.no}</td>
                  <td className="px-4 py-3 text-white font-bold">{bug.projectName}</td>
                  <td className="px-4 py-3 text-slate-400">{bug.devName}</td>
                  <td className="px-4 py-3">
                    {type === 'periode' ? (
                      <input 
                        type="text"
                        placeholder="Set Periode..."
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onSave(bug.id!, (e.target as HTMLInputElement).value);
                          }
                        }}
                      />
                    ) : (
                      <select 
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                        onChange={(e) => {
                          if (e.target.value) onSave(bug.id!, e.target.value);
                        }}
                      >
                        <option value="">Map Status...</option>
                        <option value="DONE">DONE</option>
                        <option value="ON PROGRESS">ON PROGRESS</option>
                        <option value="ON QUEUE">ON QUEUE</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
