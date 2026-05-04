/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { BugRecord, SEVERITY_WEIGHTS } from "../types";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { format, parse } from "date-fns";

import { normalizeStatus } from "../lib/normalization";

interface ExcelImportProps {
  onDataLoaded: (data: BugRecord[]) => void;
  variant?: "card" | "compact";
}

export function ExcelImport({ onDataLoaded, variant = "card" }: ExcelImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "importing" | "syncing" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSyncStatus("importing");
    setSyncMessage("Reading Excel file...");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const bstr = event.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws) as any[];

        const normalizeToDate = (val: any) => {
          if (!val) return null;
          let numVal = typeof val === 'number' ? val : parseFloat(String(val));
          if (!isNaN(numVal) && numVal > 40000 && numVal < 60000) {
            return new Date(Math.round((numVal - 25569) * 86400 * 1000));
          }
          const strVal = String(val).trim();
          if (strVal === "-" || strVal === "") return null;
          
          const possibleFormats = ["dd-MMM-yy", "dd-MMM-yyyy", "yyyy-MM-dd", "MM/dd/yyyy", "dd/MM/yyyy", "MMM yyyy", "MMM-yyyy"];
          for (const fmt of possibleFormats) {
            try {
              const d = parse(strVal, fmt, new Date());
              if (!isNaN(d.getTime())) return d;
            } catch (e) {}
          }
          return null;
        };

        const formatExcelDate = (val: any) => {
          const d = normalizeToDate(val);
          return d ? format(d, "yyyy-MM-dd") : "";
        };

        const formatExcelPeriod = (val: any) => {
          const d = normalizeToDate(val);
          if (d) return format(d, "MMM-yyyy").toUpperCase();
          const str = String(val || "").trim();
          if (/^[A-Z]{3}-\d{4}$/i.test(str)) return str.toUpperCase();
          return "";
        };

        const processedData: BugRecord[] = rawData.map((row) => {
          // Find the severity column dynamically
          const severityKey = Object.keys(row).find(k => k.toLowerCase().includes('severity')) || "Severity";
          const rawSeverity = String(row[severityKey] || "Trivia").toLowerCase();
          
          let severity: "Recurring" | "Critical" | "Major" | "Minor" | "Trivia" = "Trivia";
          if (/recur/i.test(rawSeverity)) severity = "Recurring";
          else if (/crit/i.test(rawSeverity)) severity = "Critical";
          else if (/major/i.test(rawSeverity)) severity = "Major";
          else if (/minor/i.test(rawSeverity)) severity = "Minor";
          else if (/triv/i.test(rawSeverity)) severity = "Trivia";
          
          // Find type column
          const typeKey = Object.keys(row).find(k => k.toLowerCase().includes('type')) || "Type (Bug/Change Request)";
          const rawType = String(row[typeKey] || "Bug").toLowerCase();
          let type = "Bug";
          if (/change/i.test(rawType) || /request/i.test(rawType)) type = "Change Request";
          else if (/bug/i.test(rawType)) type = "Bug";

          const bugScore = SEVERITY_WEIGHTS[severity] || 0;

          return {
            no: String(row["No"] || "").trim(),
            sectionName: String(row["Section Name"] || ""),
            projectName: String(row["Project Name"] || ""),
            typeTesting: String(row["Type Testing"] || ""),
            discoveryDate: formatExcelDate(row["Discovery Date"]),
            type: type,
            severity: severity,
            includedInFsd: String(row["Included In FSD (Ya/Tidak)"] || "Tidak"),
            remarks: String(row["Remarks"] || row["Remark"] || ""),
            screenshot: String(row["ScreenShot"] || ""),
            statusPic: String(row["Status PIC"] || ""),
            devName: String(row["Dev Name"] || "Unknown"),
            startDate: formatExcelDate(row["Start Date"]),
            finishAt: formatExcelDate(row["Finish Date"]),
            responseDev: String(row["Response Dev"] || row["Respone Dev"] || ""),
            statusDev: normalizeStatus(row["Status Dev"]),
            sitRealizedDate: formatExcelDate(row["(SIT) Realized in Date"]),
            periode: formatExcelPeriod(row["Periode"]),
            bugScore,
            total_score: bugScore,
            last_edited_at: new Date().toISOString(),
            last_edited_by: "System Bulk Import"
          };
        });

        if (isSupabaseConfigured) {
          setSyncStatus("syncing");
          setSyncMessage(`Importing ${processedData.length} records to database...`);
          
          // Use insert instead of upsert to allow duplicates as requested
          const { error } = await supabase
            .from('bugs')
            .insert(processedData);

          if (error) throw error;
        }

        onDataLoaded(processedData);
        setSyncStatus("success");
        setSyncMessage("Import successful and synced!");
        
        setTimeout(() => setSyncStatus("idle"), 3000);
      } catch (err: any) {
        console.error("Import error:", err);
        setSyncStatus("error");
        setSyncMessage(`Error: ${err.message || "Failed to sync"}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  if (variant === "compact") {
    return (
      <div className="relative">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".xlsx, .xls"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={syncStatus !== "idle"}
          className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
        >
          {syncStatus === "idle" ? (
            <>
              <Upload className="w-4 h-4" />
              <span>Bulk Import</span>
            </>
          ) : (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Syncing...</span>
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-800 rounded-[2.5rem] bg-slate-900/50 backdrop-blur-xl transition-all hover:border-blue-500/50 group relative overflow-hidden">
      {syncStatus !== "idle" && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 animate-in fade-in">
          {syncStatus === "importing" || syncStatus === "syncing" ? (
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
          ) : syncStatus === "success" ? (
            <CheckCircle2 className="w-10 h-10 text-green-500 mb-4" />
          ) : (
            <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
          )}
          <p className="font-semibold text-slate-800">{syncMessage}</p>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx, .xls"
        className="hidden"
      />
      
      <div className="flex bg-blue-50 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
        <FileSpreadsheet className="w-10 h-10 text-blue-600" />
      </div>
      
      <h3 className="text-xl font-display font-semibold mb-2">Bulk Excel Import</h3>
      <p className="text-slate-500 text-sm mb-6 text-center max-w-xs leading-relaxed">
        Upload your SIT spreadsheet. Data will automatically sync with the cloud database.
      </p>
      
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={syncStatus !== "idle"}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50"
      >
        <Upload className="w-4 h-4" />
        Choose SIT Spreadsheet
      </button>

      {!isSupabaseConfigured && (
        <div className="mt-4 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
          <AlertCircle className="w-3 h-3" />
          Database secrets not configured. Local import only.
        </div>
      )}
    </div>
  );
}
