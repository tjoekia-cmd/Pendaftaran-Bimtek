import React, { useState } from "react";
import {
  Lock,
  Compass,
  Users,
  CheckSquare,
  Sliders,
  Settings,
  FileSpreadsheet,
  Printer,
  Trash2,
  Calendar,
  Search,
  CheckCircle,
  Database,
  Phone,
  Eye,
  X,
  Download,
  Upload,
  Image
} from "lucide-react";
import { Registration, Attendance, AppSettings } from "../types";
import { ParticipantCard } from "./ParticipantCard";
import { BarcodeGenerator } from "./BarcodeGenerator";
import { motion, AnimatePresence } from "motion/react";

interface AdminPanelProps {
  settings: AppSettings;
  registrations: Registration[];
  attendance: Attendance[];
  onSaveSettings: (settings: AppSettings) => Promise<void>;
  onDeleteRegistration: (id: string) => Promise<void>;
  onDeleteAttendance: (id: string) => Promise<void>;
  onResetAllData: () => Promise<void>;
}

const compressTemplateImage = (
  base64Str: string,
  maxWidth = 1200,
  maxHeight = 800,
  quality = 0.75
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
      resolve(compressedBase64);
    };
    img.onerror = () => {
      reject(new Error("Gagal memproses gambar untuk kompresi."));
    };
  });
};

export const AdminPanel: React.FC<AdminPanelProps> = ({
  settings,
  registrations,
  attendance,
  onSaveSettings,
  onDeleteRegistration,
  onDeleteAttendance,
  onResetAllData,
}) => {
  const [password, setPassword] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState("");

  const [activeTab, setActiveTab] = useState<"stats" | "registrants" | "attendance" | "settings">("stats");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit states for settings
  const [eventTitle, setEventTitle] = useState(settings.eventTitle);
  const [durationDays, setDurationDays] = useState(settings.durationDays);
  const [startDate, setStartDate] = useState(settings.startDate || "2026-05-21");
  const [eventLocation, setEventLocation] = useState(settings.eventLocation || "");
  const [cardTemplateBase64, setCardTemplateBase64] = useState(settings.cardTemplateBase64 || "");
  const [isDragging, setIsDragging] = useState(false);
  const [templateUploadError, setTemplateUploadError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  // Printing State
  const [isPrintLayoutActive, setIsPrintLayoutActive] = useState(false);
  const [printType, setPrintType] = useState<"registrants" | "attendance" | "single-card">("registrants");
  const [selectedParticipantForCard, setSelectedParticipantForCard] = useState<Registration | null>(null);
  const [selectedAttendanceForDetail, setSelectedAttendanceForDetail] = useState<Attendance | null>(null);

  // Custom states for confirmations and PDF generators
  const [deleteRegConfirmId, setDeleteRegConfirmId] = useState<string | null>(null);
  const [deleteAttConfirmId, setDeleteAttConfirmId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showResetSuccess, setShowResetSuccess] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");
  const [singlePdfStatus, setSinglePdfStatus] = useState("");

  const formatIndonesianDate = (dateStr: string, offsetDays: number = 0) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      if (offsetDays !== 0) {
        d.setDate(d.getDate() + offsetDays);
      }
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "minangrancak") {
      setIsAuthorized(true);
      setAuthError("");
    } else {
      setAuthError("Sandi Salah! Silakan hubungi koordinator pelaksana.");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus("Menyimpan...");
    try {
      await onSaveSettings({
        ...settings,
        eventTitle,
        durationDays,
        startDate,
        eventLocation,
        cardTemplateBase64,
      });
      setSaveStatus("Pengaturan Berhasil Disimpan!");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch {
      setSaveStatus("Gagal menyimpan.");
    }
  };

  const handleTemplateFileChange = (file: File) => {
    setTemplateUploadError("");

    // Validate type
    if (!file.type.startsWith("image/")) {
      setTemplateUploadError("Format berkas harus berupa gambar (PNG, JPG, JPEG, WebP).");
      return;
    }

    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setTemplateUploadError("Ukuran terlalu besar. Maksimal adalah 5MB untuk kecepatan performa.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      try {
        const compressed = await compressTemplateImage(base64);
        setCardTemplateBase64(compressed);
      } catch (err) {
        setTemplateUploadError("Gagal mengompresi gambar template.");
      }
    };
    reader.onerror = () => {
      setTemplateUploadError("Gagal membaca gambar.");
    };
    reader.readAsDataURL(file);
  };

  const handleTemplateDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleTemplateDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleTemplateDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleTemplateFileChange(file);
    }
  };

  // Group registrations by West Sumatra regencies for statistics
  const getKabKotaStats = () => {
    const counts: { [key: string]: number } = {};
    registrations.forEach((reg) => {
      const kab = reg.kabKota || "Lainnya";
      counts[kab] = (counts[kab] || 0) + 1;
    });

    const total = registrations.length || 1;
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  };

  // Generate Excel-readable CSV formatted dataset
  const exportToExcel = (type: "registrants" | "attendance") => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (type === "registrants") {
      // Headers
      csvContent += "No,NIK,Nama,No HP,Asal Kabupaten/Kota,Alamat Lengkap,Waktu Pendaftaran\n";
      // Rows
      registrations.forEach((reg, idx) => {
        const row = [
          idx + 1,
          `"${reg.nik}"`,
          `"${reg.name.toUpperCase()}"`,
          `"${reg.phone || ""}"`,
          `"${reg.kabKota}"`,
          `"${reg.address.replace(/"/g, '""')}"`,
          `"${reg.registeredAt}"`
        ].join(",");
        csvContent += row + "\n";
      });
    } else {
      // Headers
      csvContent += "No,NIK,Nama,No HP,Hari Ke,Tanggal Absen\n";
      // Rows
      attendance.forEach((att, idx) => {
        const regMatch = registrations.find((r) => r.nik === att.nik);
        const phone = regMatch ? (regMatch.phone || "") : "";
        const row = [
          idx + 1,
          `"${att.nik}"`,
          `"${att.name.toUpperCase()}"`,
          `"${phone}"`,
          att.day,
          `"${formatIndonesianDate(settings.startDate || "2026-05-21", att.day - 1)}"`
        ].join(",");
        csvContent += row + "\n";
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `LAPORAN_BIMTEK_${type.toUpperCase()}_SUMBAR.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const triggerPrintReport = (type: "registrants" | "attendance") => {
    setPrintType(type);
    setIsPrintLayoutActive(true);
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById("print-content-area");
    if (!element) return;
    
    setPdfStatus("Menyiapkan berkas PDF...");
    const originalGetComputedStyle = window.getComputedStyle;
    try {
      // Override getComputedStyle to filter out oklch and oklab colors for html2canvas compatibility
      window.getComputedStyle = function (elt, pseudoElt) {
        const style = originalGetComputedStyle.call(window, elt, pseudoElt);
        
        const safeColor = (value: string): string => {
          if (typeof value === "string" && (value.includes("oklch") || value.includes("oklab"))) {
            // Tailwind v4 uses oklch/oklab (L C H / alpha) or similar
            if (value.includes("/")) {
              const parts = value.split("/");
              const alphaAttr = parts[parts.length - 1].replace(")", "").trim();
              const alpha = parseFloat(alphaAttr);
              return isNaN(alpha) ? "rgba(0,0,0,0)" : `rgba(71, 85, 105, ${alpha})`;
            }
            return "#475569"; // fallback neutral slate color
          }
          return value;
        };

        return new Proxy(style, {
          get(target, prop) {
            const val = Reflect.get(target, prop);
            if (typeof val === "function") {
              return function (...args: any[]) {
                const result = val.apply(target, args);
                if (prop === "getPropertyValue" && typeof result === "string" && (result.includes("oklch") || result.includes("oklab"))) {
                  return safeColor(result);
                }
                return result;
              };
            }
            if (typeof prop === "string" && typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
              return safeColor(val);
            }
            return val;
          },
        });
      };

      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false
      });
      
      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = await import("jspdf");
      
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 190; // margin left/right is 10mm (210 - 20)
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 10;
      
      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= (pageHeight - 20);
      
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= (pageHeight - 20);
      }
      
      pdf.save(`LAPORAN_BIMTEK_${printType.toUpperCase()}_SUMBAR.pdf`);
      setPdfStatus("Unduh PDF Berhasil!");
      setTimeout(() => setPdfStatus(""), 3000);
    } catch (err) {
      console.error(err);
      setPdfStatus("Gagal Mengunduh PDF.");
      setTimeout(() => setPdfStatus(""), 4000);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  };

  const handleDownloadSingleParticipantPDF = async (participant: Registration) => {
    const originalCard = document.getElementById("digital-participant-card");
    if (!originalCard) {
      setSinglePdfStatus("Elemen kartu tidak ditemukan.");
      return;
    }

    setSinglePdfStatus("Menyiapkan berkas PDF...");
    const originalGetComputedStyle = window.getComputedStyle;
    
    try {
      // Override getComputedStyle to filter out oklch and oklab colors for html2canvas compatibility
      window.getComputedStyle = function (elt, pseudoElt) {
        const style = originalGetComputedStyle.call(window, elt, pseudoElt);
        
        const safeColor = (value: string): string => {
          if (typeof value === "string" && (value.includes("oklch") || value.includes("oklab"))) {
            if (value.includes("/")) {
              const parts = value.split("/");
              const alphaAttr = parts[parts.length - 1].replace(")", "").trim();
              const alpha = parseFloat(alphaAttr);
              return isNaN(alpha) ? "rgba(0,0,0,0)" : `rgba(71, 85, 105, ${alpha})`;
            }
            return "#475569";
          }
          return value;
        };

        return new Proxy(style, {
          get(target, prop) {
            const val = Reflect.get(target, prop);
            if (typeof val === "function") {
              return function (...args: any[]) {
                const result = val.apply(target, args);
                if (prop === "getPropertyValue" && typeof result === "string" && (result.includes("oklch") || result.includes("oklab"))) {
                  return safeColor(result);
                }
                return result;
              };
            }
            if (typeof prop === "string" && typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
              return safeColor(val);
            }
            return val;
          },
        });
      };

      // 1. Create outer wrapper container representing an off-screen A4 sheet
      const wrapper = document.createElement("div");
      wrapper.id = "temp-pdf-a4-sheet";
      wrapper.style.position = "absolute";
      wrapper.style.left = "-9999px";
      wrapper.style.top = "-9999px";
      wrapper.style.width = "820px";
      wrapper.style.height = "1160px";
      wrapper.style.backgroundColor = "#ffffff";
      wrapper.style.color = "#000000";
      wrapper.style.fontFamily = "system-ui, -apple-system, sans-serif";
      wrapper.style.padding = "45px";
      wrapper.style.boxSizing = "border-box";
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";

      // 2. Add Kop Surat, details, signature column, card column, and KTP section
      wrapper.innerHTML = `
        <!-- HEADER LETTERHEAD -->
        <div style="text-align: center; border-bottom: 3px double #000000; padding-bottom: 12px; margin-bottom: 24px; font-family: sans-serif;">
          <h1 style="font-size: 16px; font-weight: 850; text-transform: uppercase; margin: 0; letter-spacing: 0.5px; color: #000000;">PEMERINTAH PROVINSI SUMATERA BARAT</h1>
          <h2 style="font-size: 19px; font-weight: 900; text-transform: uppercase; margin: 4px 0 0 0; letter-spacing: 1px; color: #000000;">DINAS PARIWISATA</h2>
          <p style="font-size: 11px; margin: 4px 0 0 0; font-weight: 500; color: #334155;">Jl. Khatib Sulaiman no.7 Ulak Karang Kota Padang</p>
        </div>

        <!-- DOCUMENT TITLE -->
        <div style="text-align: center; margin-bottom: 24px;">
          <h3 style="font-size: 14px; font-weight: 800; text-transform: uppercase; margin: 0; letter-spacing: 0.5px; text-decoration: underline; color: #0f172a;">LEMBAR REKAPITULASI DATA PESERTA</h3>
          <p style="font-size: 11px; font-weight: 600; margin: 4px 0 0 0; color: #475569; text-transform: uppercase;">
            EVENT RESMI
          </p>
        </div>

        <!-- MAIN LAYOUT: TWO-COLUMN CONTENT GRID -->
        <div style="display: flex; gap: 24px; align-items: stretch; margin-bottom: 20px;">
          <!-- LEFT: Registration Info & Signature -->
          <div style="flex: 1.25; display: flex; flex-direction: column; gap: 16px;">
            <!-- Info Details Block -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-sizing: border-box;">
              <span style="font-size: 10px; background-color: #f1f5f9; color: #0f172a; font-weight: bold; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; display: inline-block; margin-bottom: 14px;">
                Data KTP & Kontak Peserta Pasca Verifikasi
              </span>
              
              <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <tbody>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 0; font-weight: bold; color: #64748b; width: 33%;">NAMA AJUAN</td>
                    <td style="padding: 8px 0; font-weight: 950; color: #0f172a; text-transform: uppercase;">${participant.name}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 0; font-weight: bold; color: #64748b;">NIK KTP</td>
                    <td style="padding: 8px 0; font-weight: bold; font-family: monospace; color: #0f172a; font-size: 12px;">${participant.nik}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 0; font-weight: bold; color: #64748b;">NO. HANDPHONE</td>
                    <td style="padding: 8px 0; font-weight: bold; color: #059669;">${participant.phone || "-"}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 0; font-weight: bold; color: #64748b;">DOMISILI</td>
                    <td style="padding: 8px 0; font-weight: bold; color: #0f172a;">${participant.kabKota}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 0; font-weight: bold; color: #64748b;">ALAMAT LENGKAP</td>
                    <td style="padding: 8px 0; color: #334155; line-height: 1.4;">${participant.address || "-"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #64748b; vertical-align: top;">KEGIATAN</td>
                    <td style="padding: 8px 0; font-weight: bold; color: #0f172a; line-height: 1.3;">${eventTitle}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Signature block -->
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; box-sizing: border-box;">
              <span style="font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 8px;">
                Tanda Tangan Peserta (Digital)
              </span>
              <div style="display: flex; justify-content: center; align-items: center; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 8px; background-color: #f8fafc; height: 105px; box-sizing: border-box;">
                ${participant.signatureBase64 ? `
                  <img src="${participant.signatureBase64}" style="max-height: 90px; max-width: 100%; object-fit: contain;" />
                ` : `
                  <span style="font-size: 11px; color: #94a3b8; font-style: italic;">Tidak ada tanda tangan.</span>
                `}
              </div>
            </div>
          </div>

          <!-- RIGHT: Digital Card Placement -->
          <div style="flex: 0.85; display: flex; flex-direction: column; align-items: center; justify-content: start;">
            <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 8px; text-align: center;">
              Pratinjau Kartu Digital (Tampak Depan)
            </div>
            <div id="cloned-card-pdf-placeholder" style="width: 270px; display: flex; justify-content: center; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">
              <!-- Cloned card will be inserted here -->
            </div>
          </div>
        </div>

        <!-- UPLOADED KTP PORTION -->
        <div style="border-top: 1px dashed #cbd5e1; padding-top: 18px; margin-top: auto; box-sizing: border-box;">
          <span style="font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 10px;">
            Unggahan Berkas Identitas KTP Resmi
          </span>
          <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; background-color: #f8fafc; display: flex; justify-content: center; align-items: center; max-height: 250px; overflow: hidden; box-sizing: border-box;">
            ${participant.ktpBase64 ? `
              <img src="${participant.ktpBase64}" style="max-height: 220px; max-width: 100%; object-fit: contain; border-radius: 6px;" />
            ` : `
              <span style="font-size: 11px; color: #94a3b8; font-style: italic; padding: 30px 0;">Peserta mendaftar mandiri tanpa mengunggah berkas/foto KTP.</span>
            `}
          </div>
        </div>

        <!-- FOOTER INFO -->
        <div style="margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #94a3b8; box-sizing: border-box; font-family: sans-serif;">
          <div>Dinas Pariwisata Provinsi Sumatera Barat &copy; 2026</div>
        </div>
      `;

      // 3. Clone and insert the participant card beautifully inside the right placeholder
      const placeholder = wrapper.querySelector("#cloned-card-pdf-placeholder");
      if (placeholder) {
        const cardClone = originalCard.cloneNode(true) as HTMLDivElement;
        
        // Remove interactive helper styles or dynamic classes if any
        cardClone.classList.remove("w-full");
        cardClone.style.width = "270px";
        cardClone.style.height = "432px"; // keep the rigorous 5:8 ratio (270 * 1.6)
        cardClone.style.aspectRatio = "auto";
        cardClone.style.boxSizing = "border-box";
        cardClone.style.margin = "0";

        placeholder.appendChild(cardClone);
      }

      // Append to body temporarily so html2canvas can measure layout perfectly
      document.body.appendChild(wrapper);

      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(wrapper, {
        scale: 3, // Premium quality text and lines
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false
      });
      
      // Clean up body
      document.body.removeChild(wrapper);
      
      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = await import("jspdf");
      
      const pdf = new jsPDF("p", "mm", "a4");
      // A4 dimensions are 210mm x 297mm
      pdf.addImage(imgData, "PNG", 0, 0, 210, 297, undefined, 'FAST');
      
      const safeName = participant.name.toUpperCase().replace(/[^A-Za-z0-9]/g, "_");
      pdf.save(`KARTU_DOKUMEN_PESERTA_${safeName}.pdf`);
      setSinglePdfStatus("Unduh PDF Berhasil!");
      setTimeout(() => setSinglePdfStatus(""), 3000);
    } catch (err) {
      console.error(err);
      setSinglePdfStatus("Gagal Mengunduh PDF.");
      setTimeout(() => setSinglePdfStatus(""), 4000);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  };

  const filteredRegistrants = registrations.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.nik.includes(searchQuery) ||
      r.phone?.includes(searchQuery) ||
      r.kabKota.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAttendance = attendance.filter((a) => {
    const regMatch = registrations.find((r) => r.nik === a.nik);
    const phone = regMatch ? (regMatch.phone || "") : "";
    return (
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.nik.includes(searchQuery) ||
      phone.includes(searchQuery)
    );
  });

  if (!isAuthorized) {
    return (
      <div className="w-full max-w-sm mx-auto bg-white rounded-2xl border border-slate-100 p-6 shadow-xl my-6 animate-fade-in">
        <div className="flex flex-col items-center text-center space-y-4 mb-6">
          <div className="p-3 bg-slate-100 text-emerald-800 rounded-xl">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Keamanan Panel Admin</h2>
            <p className="text-xs text-gray-500">Silakan masukkan kata sandi pemantau resmi Dinas</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-widest block">
              Sandi Kunci Admin (Password)
            </label>
            <input
              type="password"
              placeholder="Masukkan Sandi Admin..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500"
              required
            />
            {authError && <p className="text-xs text-red-600 font-medium">{authError}</p>}
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition-all text-sm"
          >
            Masuk Panel Admin
          </button>
        </form>
      </div>
    );
  }

  const selectedRegDetail = selectedAttendanceForDetail
    ? registrations.find((r) => r.nik === selectedAttendanceForDetail.nik)
    : null;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* EXPLICIT BLACK-AND-WHITE PRINT LAYOUT & PRINTER PREVIEW WITH EXCELLENT CONTROL PANEL */}
      {isPrintLayoutActive && (
        <div className="fixed inset-0 bg-white z-[99999] overflow-y-auto pt-24 pb-12 px-4 sm:px-12 text-black print:p-0 print:pt-0">
          
          {/* STICKY TOP CONTROL PANEL FOR USER EXPERIENCE (Hidden during real printing via no-print class) */}
          <div className="no-print fixed top-0 left-0 right-0 h-20 bg-slate-900 border-b border-slate-800 text-white flex flex-col sm:flex-row items-center justify-between px-6 z-[999999] shadow-2xl gap-3">
            <div className="text-left py-1 sm:py-0">
              <span className="text-[9px] bg-emerald-600 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                PRATINJAU DOKUMEN CETAK SUMBAR ({printType === "registrants" ? "PENDAFTAR" : "ABSENSI"})
              </span>
              <h3 className="text-xs sm:text-sm font-black tracking-tight text-white mt-1 uppercase">
                Arah: Portrait (Tegak) | Sesuaikan Di Dialog Printer
              </h3>
            </div>
            
            <div className="flex items-center gap-2 mb-2 sm:mb-0">
              {pdfStatus && (
                <span className="text-xs text-amber-300 font-bold animate-pulse mr-2 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                  {pdfStatus}
                </span>
              )}
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Printer</span>
              </button>
              
              <button
                onClick={handleDownloadPDF}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Simpan PDF</span>
              </button>
              
              <button
                onClick={() => setIsPrintLayoutActive(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-extrabold rounded-xl flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Tutup</span>
              </button>
            </div>
          </div>

          {/* PRINTABLE DOKUMEN CONTAINER FOR PDF GENERATION */}
          <div id="print-content-area" className="bg-white text-black font-sans max-w-4xl mx-auto p-4 md:p-8 print:p-0">
            {/* Header */}
            <div className="border-b-4 border-double border-black pb-4 text-center mb-6">
              <h1 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-black">
                Pemerintah Provinsi Sumatera Barat
              </h1>
              <h2 className="text-base sm:text-lg font-extrabold tracking-wider uppercase text-black mt-0.5">
                Dinas Pariwisata
              </h2>
              <p className="text-[10px] sm:text-xs font-semibold text-black mt-1">
                Jl. Khatib Sulaiman no.7 Ulak Karang Kota Padang
              </p>
            </div>

            {printType === "single-card" && selectedParticipantForCard ? (
              /* PRINT TYPE: SINGLE CARD */
              <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 bg-white text-black">
                <div className="my-6 text-center">
                  <span className="text-xs font-mono uppercase tracking-widest border border-black px-3 py-1 font-bold">
                    DOKUMEN RESMI: KARTU PESERTA DIGITAL
                  </span>
                  <p className="text-xs font-bold mt-3 font-sans uppercase">
                    Kegiatan: {settings.eventTitle}
                  </p>
                  {settings.eventLocation && (
                    <p className="text-[10px] font-bold mt-1 font-sans uppercase text-gray-700">
                      Lokasi Kegiatan: {settings.eventLocation}
                    </p>
                  )}
                </div>

                {/* Card wrapper centered */}
                <div className="border border-black rounded-3xl p-6 shadow-sm bg-white inline-block max-w-sm w-full mx-auto text-black">
                  {/* Visual Header */}
                  <div 
                    className="p-6 rounded-t-2xl text-white relative overflow-hidden text-center"
                    style={{
                      backgroundColor: selectedParticipantForCard.color || "#0F6251",
                    }}
                  >
                    <div className="text-[10px] tracking-widest font-bold uppercase text-white/80">KARTU PESERTA DIGITAL</div>
                    <h3 className="text-sm font-extrabold mt-1 tracking-tight uppercase leading-tight">{settings.eventTitle}</h3>
                    <div className="text-[9px] uppercase mt-1 tracking-wider opacity-90">DINAS PARIWISATA SUMBAR</div>
                  </div>

                  {/* Content body */}
                  <div className="p-6 bg-slate-50 border-x border-b border-slate-200 rounded-b-2xl space-y-4">
                    <div className="space-y-1.5">
                      <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">NAMA AJUAN</div>
                      <div className="text-sm font-black text-gray-950 uppercase">{selectedParticipantForCard.name}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">NIK KTP</div>
                        <div className="text-xs font-mono font-bold text-gray-850">{selectedParticipantForCard.nik}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">NO. TELP / WA</div>
                        <div className="text-xs font-bold text-gray-850">{selectedParticipantForCard.phone || "-"}</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">DOMISILI DAERAH</div>
                      <div className="text-xs font-bold text-gray-850">{selectedParticipantForCard.kabKota}</div>
                    </div>

                    {/* Barcode representation */}
                    <div className="bg-white rounded-xl p-3 border border-slate-200 flex flex-col items-center justify-center">
                      <BarcodeGenerator value={selectedParticipantForCard.nik} height={38} />
                    </div>
                  </div>
                </div>

                {/* Instructions bottom */}
                <p className="text-[10px] text-gray-400 text-center uppercase tracking-wider mt-12">
                  Kartu ini merupakan tanda pengenal resmi selama acara berlangsung.
                </p>
              </div>
            ) : (
              <>
                <div className="my-6 text-center">
                  <span className="text-xs font-mono uppercase tracking-widest border border-black px-3 py-1 font-bold">
                    {printType === "registrants" ? "DOKUMEN RESMI: CETAK TABEL PENDAFTAR" : "DOKUMEN RESMI: CETAK TABEL ABSENSI"}
                  </span>
                  <p className="text-xs font-bold mt-3 font-sans uppercase">
                    Kegiatan: {settings.eventTitle}
                  </p>
                  <p className="text-[10px] font-bold font-sans uppercase mt-1">
                    Tanggal Kegiatan: {formatIndonesianDate(settings.startDate || "2026-05-21")} s/d {formatIndonesianDate(settings.startDate || "2026-05-21", (settings.durationDays || 3) - 1)}
                  </p>
                  {settings.eventLocation && (
                    <p className="text-[10px] font-bold font-sans uppercase mt-1">
                      Lokasi Kegiatan: {settings.eventLocation}
                    </p>
                  )}
                </div>

                {printType === "registrants" ? (
                  /* PRINT TYPE: REGISTRANTS TABLE */
                  <table className="w-full text-left border-collapse border border-black text-[10px]">
                    <thead>
                      <tr className="border-b border-black bg-slate-100 font-bold">
                        <th className="p-2 border border-black w-8">No</th>
                        <th className="p-2 border border-black">Nama Lengkap</th>
                        <th className="p-2 border border-black">NIK</th>
                        <th className="p-2 border border-black">No. Telp / WhatsApp</th>
                        <th className="p-2 border border-black">Domisili</th>
                        <th className="p-2 border border-black w-56 text-center">Foto KTP</th>
                        <th className="p-2 border border-black w-48 text-center">Tanda Tangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrations.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center border border-black">Tidak ada data pendaftar.</td>
                        </tr>
                      ) : (
                        registrations.map((reg, idx) => (
                          <tr key={reg.id} className="border-b border-black">
                            <td className="p-2 border border-black text-center">{idx + 1}</td>
                            <td className="p-2 border border-black font-extrabold">{reg.name.toUpperCase()}</td>
                            <td className="p-2 border border-black font-mono">{reg.nik}</td>
                            <td className="p-2 border border-black">{reg.phone || "-"}</td>
                            <td className="p-2 border border-black">{reg.kabKota}</td>
                            <td className="p-2 border border-black text-center align-middle w-56">
                              {reg.ktpBase64 ? (
                                <img
                                  src={reg.ktpBase64}
                                  alt="Foto KTP"
                                  className="max-h-32 max-w-full object-contain mx-auto border border-black/10 shadow-sm"
                                />
                              ) : (
                                <span className="text-gray-400 text-[9px] italic">Tidak Ada KTP</span>
                              )}
                            </td>
                            <td className="p-2 border border-black h-28 relative text-center">
                              <span className="text-[8px] text-gray-400 absolute top-1.5 left-1.5 font-bold">{idx + 1}.</span>
                              {reg.signatureBase64 ? (
                                <img
                                  src={reg.signatureBase64}
                                  alt="Tanda Tangan"
                                  className="max-h-24 max-w-full object-contain mx-auto mix-blend-multiply"
                                  referrerPolicy="no-referrer"
                                />
                              ) : null}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {registrations.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-50 font-bold border-t border-black text-[10px]">
                          <td colSpan={6} className="p-2 border border-black text-right uppercase tracking-wider">Total Peserta Terdaftar:</td>
                          <td className="p-2 border border-black text-center font-black">{registrations.length} Orang</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                ) : (
                  /* PRINT TYPE: ATTENDANCE TABLE WITH SIGNATURE PREVIEWS */
                  <table className="w-full text-left border-collapse border border-black text-[10px]">
                    <thead>
                      <tr className="border-b border-black bg-slate-100 font-bold">
                        <th className="p-2 border border-black w-8">No</th>
                        <th className="p-2 border border-black">Nama Lengkap</th>
                        <th className="p-2 border border-black">NIK</th>
                        <th className="p-2 border border-black">No. Telp / WhatsApp</th>
                        <th className="p-2 border border-black text-center">Hari Ke / Tanggal</th>
                        <th className="p-2 border border-black w-48 text-center">Tanda Tangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center border border-black">Tidak ada data absensi.</td>
                        </tr>
                      ) : (
                        attendance.map((att, idx) => {
                          const rMatch = registrations.find((r) => r.nik === att.nik);
                          return (
                            <tr key={att.id} className="border-b border-black">
                              <td className="p-2 border border-black text-center">{idx + 1}</td>
                              <td className="p-2 border border-black font-extrabold">{att.name.toUpperCase()}</td>
                              <td className="p-2 border border-black font-mono">{att.nik}</td>
                              <td className="p-2 border border-black">{rMatch ? rMatch.phone || "-" : "-"}</td>
                              <td className="p-2 border border-black text-center font-bold">
                                Hari {att.day} ({formatIndonesianDate(settings.startDate || "2026-05-21", att.day - 1)})
                              </td>
                              <td className="p-2 border border-black h-28 text-center relative">
                                <span className="text-[8px] text-gray-400 absolute top-1.5 left-1.5 font-bold">{idx + 1}.</span>
                                {att.signatureBase64 && (
                                  <img
                                    src={att.signatureBase64}
                                    alt="Paraf"
                                    className="max-h-24 h-24 object-contain max-w-full mx-auto mix-blend-multiply"
                                    referrerPolicy="no-referrer"
                                  />
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {attendance.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-50 font-bold border-t border-black text-[10px]">
                          <td colSpan={5} className="p-2 border border-black text-right uppercase tracking-wider">Total Log Kehadiran:</td>
                          <td className="p-2 border border-black text-center font-black">{attendance.length} Kali</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* DASHBOARD CONTAINER SYSTEM (NON-PRINT VIEW) */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Background mesh glow */}
        <div className="absolute top-[-20%] right-[-10%] w-96 h-96 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 blur-[100px] pointer-events-none rounded-full" />

        {/* Header */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6 mb-8">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-700/20">
              <Compass className="w-7 h-7 text-white" />
            </div>
            <div>
              <span className="text-xs uppercase font-bold tracking-widest text-emerald-400">Panel Pemantau Bimtek</span>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-0.5 text-white">Dasbor Real-Time Dinas</h1>
            </div>
          </div>

          {/* Contextual Printing & Export Actions based on selected Tab */}
          <div className="flex flex-wrap gap-2.5">
            {activeTab === "registrants" && (
              <>
                <button
                  onClick={() => exportToExcel("registrants")}
                  className="flex items-center space-x-1.5 bg-white/10 hover:bg-white/15 text-white px-4 py-2.5 rounded-xl text-xs font-semibold select-none border border-white/5 active:scale-95 transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ekspor Excel</span>
                </button>
                <button
                  onClick={() => triggerPrintReport("registrants")}
                  className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold select-none active:scale-95 transition-all shadow-lg"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Tabel Pendaftar</span>
                </button>
              </>
            )}

            {activeTab === "attendance" && (
              <>
                <button
                  onClick={() => exportToExcel("attendance")}
                  className="flex items-center space-x-1.5 bg-white/10 hover:bg-white/15 text-white px-4 py-2.5 rounded-xl text-xs font-semibold select-none border border-white/5 active:scale-95 transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ekspor Excel</span>
                </button>
                <button
                  onClick={() => triggerPrintReport("attendance")}
                  className="flex items-center space-x-1.5 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold select-none active:scale-95 transition-all shadow-lg"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Tabel Absensi</span>
                </button>
              </>
            )}

            {activeTab === "stats" && null}
          </div>
        </div>

        {/* Tabs navigation */}
        <div className="flex border-b border-white/10 mb-8 overflow-x-auto gap-2">
          {[
            { id: "stats", label: "Statistik & Grafik", icon: Users },
            { id: "registrants", label: "Tabel Pendaftar", icon: Compass },
            { id: "attendance", label: "Tabel Kehadiran (Absensi)", icon: CheckSquare },
            { id: "settings", label: "Pengaturan Bimtek", icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 whitespace-nowrap px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                  activeTab === tab.id
                    ? "border-emerald-500 text-emerald-400 font-extrabold"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab contents */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "stats" && (
              <div className="space-y-8 animate-fade-in">
                {/* 3-Col numerical stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-800/50 hover:bg-slate-800 border border-white/5 p-6 rounded-2xl flex items-center space-x-4 transition-all">
                    <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-xl">
                      <Users className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">Pendaftar Terverifikasi</h4>
                      <p className="text-3xl font-extrabold text-white mt-1">{registrations.length} <span className="text-xs font-normal text-slate-400">orang</span></p>
                    </div>
                  </div>

                  <div className="bg-slate-800/50 hover:bg-slate-800 border border-white/5 p-6 rounded-2xl flex items-center space-x-4 transition-all">
                    <div className="p-4 bg-teal-500/10 text-teal-400 rounded-xl">
                      <CheckSquare className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">Log Absensi Terinput</h4>
                      <p className="text-3xl font-extrabold text-white mt-1">{attendance.length} <span className="text-xs font-normal text-slate-400">kali hadir</span></p>
                    </div>
                  </div>

                  <div className="bg-slate-800/50 hover:bg-slate-800 border border-white/5 p-6 rounded-2xl flex items-center space-x-4 transition-all">
                    <div className="p-4 bg-blue-500/10 text-blue-400 rounded-xl">
                      <Calendar className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">Durasi Event</h4>
                      <p className="text-3xl font-extrabold text-white mt-1">{settings.durationDays} <span className="text-xs font-normal text-slate-400">Hari Bimtek</span></p>
                    </div>
                  </div>
                </div>

                {/* Map/Regency Origins graph chart widgets */}
                <div className="bg-slate-800/30 border border-white/5 rounded-2xl p-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-6 text-emerald-400 flex items-center space-x-2">
                    <Database className="w-4 h-4" />
                    <span>Persebaran Domisili Peserta Sumatera Barat (Kabupaten / Kota)</span>
                  </h3>

                  {registrations.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      Belum ada data pendaftar. Menunggu peserta melengkapi pendaftaran.
                    </div>
                  ) : (
                    <div className="space-y-4 max-w-2xl">
                      {getKabKotaStats().map((item, idx) => (
                        <div key={item.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-slate-200 flex items-center space-x-1.5">
                              <span className="text-slate-500 w-4 font-mono">{idx + 1}.</span>
                              <span>{item.name}</span>
                            </span>
                            <span className="text-emerald-400 font-bold">{item.count} Peserta ({item.percentage}%)</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${item.percentage}%` }}
                              transition={{ duration: 0.6, delay: idx * 0.05 }}
                              className="bg-gradient-to-r from-emerald-600 to-teal-400 h-full rounded-full"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "registrants" && (
              <div className="space-y-6">
                {/* Search query row */}
                <div className="flex items-center bg-slate-800/80 border border-white/5 rounded-xl px-4 py-2">
                  <Search className="w-4 h-4 text-slate-400 mr-2" />
                  <input
                    type="text"
                    placeholder="Saring berdasarkan nama, NIK, No. HP, kabupaten/kota..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none text-white focus:outline-none text-xs sm:text-sm w-full"
                  />
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-800/10">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-slate-800/30 text-xs text-slate-400 uppercase tracking-wider">
                        <th className="p-4 font-bold">No</th>
                        <th className="p-4 font-bold">Peserta</th>
                        <th className="p-4 font-bold">NIK</th>
                        <th className="p-4 font-bold">No. HP / WA</th>
                        <th className="p-4 font-bold">Domisili</th>
                        <th className="p-4 font-bold">Tanggal Daftar</th>
                        <th className="p-4 font-bold text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {filteredRegistrants.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center p-8 text-slate-400 italic">
                            Data pendaftar kosong atau tidak ditemukan saringan pencarian.
                          </td>
                        </tr>
                      ) : (
                        filteredRegistrants.map((reg, idx) => (
                          <tr key={reg.id} className="hover:bg-slate-800/30 text-white">
                            <td className="p-4 font-mono text-slate-500">{idx + 1}</td>
                            <td className="p-4">
                              <div className="font-bold text-slate-100">{reg.name.toUpperCase()}</div>
                            </td>
                            <td className="p-4 font-mono">{reg.nik}</td>
                            <td className="p-4 flex items-center space-x-1.5 font-semibold text-emerald-400">
                              <Phone className="w-3.5 h-3.5 shrink-0" />
                              <span>{reg.phone || "-"}</span>
                            </td>
                            <td className="p-4 text-slate-300 font-semibold">{reg.kabKota}</td>
                            <td className="p-4 text-slate-400">
                              {new Date(reg.registeredAt).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="p-4 text-center flex items-center justify-center">
                              {deleteRegConfirmId === reg.id ? (
                                <div className="flex items-center space-x-1.5 bg-red-500/10 border border-red-500/20 p-1 rounded-lg">
                                  <span className="text-[10px] text-red-400 font-bold px-1 uppercase tracking-wider">Hapus?</span>
                                  <button
                                    onClick={() => {
                                      onDeleteRegistration(reg.id);
                                      setDeleteRegConfirmId(null);
                                    }}
                                    className="bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] px-2 py-0.5 rounded transition-all uppercase animate-pulse"
                                    title="Ya, Hapus Peserta"
                                  >
                                    Ya
                                  </button>
                                  <button
                                    onClick={() => setDeleteRegConfirmId(null)}
                                    className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-[10px] px-2 py-0.5 rounded transition-all uppercase"
                                    title="Batalkan"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => {
                                      setSelectedParticipantForCard(reg);
                                    }}
                                    className="text-emerald-400 hover:text-emerald-300 p-1 bg-emerald-500/10 hover:bg-emerald-500/25 rounded transition-all inline-block"
                                    title="Lihat Kartu"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeleteRegConfirmId(reg.id);
                                    }}
                                    className="text-red-400 hover:text-red-300 p-1 bg-red-500/10 hover:bg-red-500/25 rounded transition-all inline-block"
                                    title="Hapus"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Total participants info at the bottom of the table */}
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-800/20 border border-white/5 p-4 rounded-xl text-xs text-slate-300 font-medium">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Menampilkan <strong>{filteredRegistrants.length}</strong> dari <strong>{registrations.length}</strong> peserta terdaftar</span>
                  </div>
                  <div className="text-sm font-bold text-slate-200">
                    Total Peserta Terdaftar: <span className="text-emerald-400 font-black text-base ml-1">{registrations.length}</span> orang
                  </div>
                </div>
              </div>
            )}

            {activeTab === "attendance" && (
              <div className="space-y-6">
                {/* Search query row */}
                <div className="flex items-center bg-slate-800/80 border border-white/5 rounded-xl px-4 py-2">
                  <Search className="w-4 h-4 text-slate-400 mr-2" />
                  <input
                    type="text"
                    placeholder="Saring berdasarkan nama, NIK, No. HP, dll..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none text-white focus:outline-none text-xs sm:text-sm w-full"
                  />
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-800/10">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-slate-800/30 text-xs text-slate-400 uppercase tracking-wider">
                        <th className="p-4 font-bold">No</th>
                        <th className="p-4 font-bold">Peserta</th>
                        <th className="p-4 font-bold">Hari Ke</th>
                        <th className="p-4 font-bold">Tanda Tangan Digital</th>
                        <th className="p-4 font-bold">Tanggal Absen</th>
                        <th className="p-4 font-bold text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {filteredAttendance.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center p-8 text-slate-400 italic">
                            Data absensi kosong atau tidak ditemukan saringan pencarian.
                          </td>
                        </tr>
                      ) : (
                        filteredAttendance.map((att, idx) => {
                          const rMatch = registrations.find((r) => r.nik === att.nik);
                          return (
                            <tr key={att.id} className="hover:bg-slate-800/30 text-white">
                              <td className="p-4 font-mono text-slate-500">{idx + 1}</td>
                              <td className="p-4">
                                <div className="font-bold text-slate-100">{att.name.toUpperCase()}</div>
                                <div className="text-[10px] text-slate-400 font-mono">NIK: {att.nik} | Telp: {rMatch ? rMatch.phone || "-" : "-"}</div>
                              </td>
                              <td className="p-4 font-mono">
                                <span className="bg-teal-500/10 text-teal-300 font-bold px-2 py-1 rounded">
                                  Hari {att.day}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="bg-white rounded-lg p-1 w-24 border border-white/10 h-10 flex items-center justify-center">
                                  {att.signatureBase64 && (
                                    <img
                                      src={att.signatureBase64}
                                      alt="Sign preview"
                                      className="max-w-full max-h-full object-contain mix-blend-multiply"
                                    />
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-slate-400 font-medium">
                                {formatIndonesianDate(settings.startDate || "2026-05-21", att.day - 1)}
                              </td>
                              <td className="p-4 text-center flex items-center justify-center">
                                {deleteAttConfirmId === att.id ? (
                                  <div className="flex items-center space-x-1.5 bg-red-500/10 border border-red-500/20 p-1 rounded-lg">
                                    <span className="text-[10px] text-red-400 font-bold px-1 uppercase tracking-wider">Hapus?</span>
                                    <button
                                      onClick={() => {
                                        onDeleteAttendance(att.id);
                                        setDeleteAttConfirmId(null);
                                      }}
                                      className="bg-red-650 hover:bg-red-600 text-white font-bold text-[10px] px-2 py-0.5 rounded transition-all uppercase animate-pulse"
                                      title="Ya, Hapus Absensi"
                                    >
                                      Ya
                                    </button>
                                    <button
                                      onClick={() => setDeleteAttConfirmId(null)}
                                      className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-[10px] px-2 py-0.5 rounded transition-all uppercase"
                                      title="Batalkan"
                                    >
                                      Batal
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => {
                                        setSelectedAttendanceForDetail(att);
                                      }}
                                      className="text-emerald-400 hover:text-emerald-300 p-1 bg-emerald-500/10 hover:bg-emerald-500/25 rounded transition-all inline-block"
                                      title="Lihat Detail Absensi"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setDeleteAttConfirmId(att.id);
                                      }}
                                      className="text-red-400 hover:text-red-300 p-1 bg-red-500/10 hover:bg-red-500/25 rounded transition-all inline-block"
                                      title="Hapus"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Total attendance info at the bottom of the table */}
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-800/20 border border-white/5 p-4 rounded-xl text-xs text-slate-300 font-medium">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse"></span>
                    <span>Menampilkan <strong>{filteredAttendance.length}</strong> dari <strong>{attendance.length}</strong> log kehadiran</span>
                  </div>
                  <div className="text-sm font-bold text-slate-200">
                    Total Kehadiran: <span className="text-teal-400 font-black text-base ml-1">{attendance.length}</span> kali hadir
                  </div>
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="space-y-6">
                <form onSubmit={handleSaveSettings} className="space-y-6 max-w-xl bg-slate-800/10 border border-white/5 p-6 rounded-2xl animate-fade-in">
                  {/* Judul acara */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Nama / Judul Kegiatan Bimtek Official
                    </label>
                    <textarea
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      required
                    />
                  </div>

                  {/* Duration */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
                      <span>Durasi Kegiatan (Hari)</span>
                      <span className="text-emerald-400 text-sm font-semibold">{durationDays} Hari</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={durationDays}
                      onChange={(e) => setDurationDays(parseInt(e.target.value))}
                      className="w-full accent-emerald-500 bg-slate-800 rounded-lg h-2"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>1 HARI (Absen Disembunyikan)</span>
                      <span>10 HARI MAX</span>
                    </div>
                  </div>

                  {/* Tanggal Mulai Bimtek */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Tanggal Mulai Kegiatan Bimtek
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                      required
                    />
                  </div>

                  {/* Lokasi Kegiatan Bimtek */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Lokasi Kegiatan Bimtek
                    </label>
                    <input
                      type="text"
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      placeholder="Contoh: Pangeran Beach Hotel, Padang, Sumatera Barat"
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                      required
                    />
                  </div>

                  {/* Upload Sandi / Background Template Kartu */}
                  <div className="space-y-3 pt-2">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Background Template Kartu Peserta Digital
                    </label>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Anda dapat mengunggah gambar latar belakang kartu kustom untuk menggantikan warna standar dinamis yang dihasilkan sistem saat pendaftaran.
                    </p>

                    <div
                      onDragOver={handleTemplateDragOver}
                      onDragLeave={handleTemplateDragLeave}
                      onDrop={handleTemplateDrop}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                        isDragging
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                          : "border-slate-700 bg-slate-800/40 hover:border-slate-500 text-slate-400"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="mx-auto w-10 h-10 bg-slate-850 rounded-xl flex items-center justify-center text-slate-300">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-200">
                            Seret & jatuhkan berkas gambar di sini, atau{" "}
                            <label className="text-emerald-400 hover:text-emerald-300 cursor-pointer underline">
                              pilih berkas
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleTemplateFileChange(file);
                                }}
                                className="hidden"
                              />
                            </label>
                          </p>
                          <p className="text-[10px] text-slate-500">PNG, JPG, JPEG, atau WebP (Maks. 5MB)</p>
                        </div>
                      </div>
                    </div>

                    {templateUploadError && (
                      <p className="text-xs text-red-400 mt-1 font-medium bg-red-500/10 p-2.5 rounded-xl border border-red-500/10">
                        {templateUploadError}
                      </p>
                    )}

                    {/* Dimensi & Preview */}
                    <div className="bg-slate-800/10 border border-white/5 p-4 rounded-xl space-y-3 text-[11px] text-slate-300">
                      <div className="flex items-start space-x-2">
                        <Image className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-slate-200 block mb-0.5">Rekomendasi Dimensi Gambar:</strong>
                          <span className="leading-relaxed block">
                            Ukuran ideal adalah <strong className="text-emerald-300 font-bold">800 &times; 1280 piksel</strong> (atau kelipatannya dengan rasio vertikal portrait <strong className="text-emerald-300 font-bold">5:8 / 1:1.6</strong>). Rasio ini memastikan kartu tercetak dengan sempurna, tajam, dan tidak terdistorsi.
                          </span>
                        </div>
                      </div>

                      {cardTemplateBase64 ? (
                        <div className="pt-2 border-t border-slate-700/40 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-16 rounded border border-slate-700 bg-slate-900 overflow-hidden shrink-0 relative flex items-center justify-center">
                              <img
                                src={cardTemplateBase64}
                                alt="Template Background Preview"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-200">Template Kustom Aktif</p>
                              <p className="text-[10px] text-slate-500">Akan diterapkan ke semua kartu peserta baru & lama</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCardTemplateBase64("")}
                            className="text-xs text-red-400 hover:text-red-350 hover:bg-red-500/10 py-1 px-2.5 rounded-lg border border-red-500/20 active:scale-95 transition-all text-[11px]"
                          >
                            Hapus Template
                          </button>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-slate-700/40">
                          <span className="text-slate-500 italic">Menggunakan background dasar dinamis dengan warna otomatis yang diproses oleh Gemini AI saat melakukan pendaftaran.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {saveStatus && (
                    <div className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                      {saveStatus}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Simpan Konfigurasi Bimtek</span>
                  </button>
                </form>

                {/* Reset Data Section */}
                <div className="max-w-xl bg-red-950/20 border border-red-500/20 p-6 rounded-2xl animate-fade-in space-y-4 text-slate-200">
                  <div className="flex items-start space-x-3">
                    <Database className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider">
                        Atur Ulang Data (Reset untuk Bimtek Baru)
                      </h4>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        Aksi ini akan menghapus secara permanen semua data pendaftar peserta, foto kartu identitas (KTP), tanda tangan digital, dan seluruh berkas kehadiran saat ini. Pengaturan nama dan waktu kegiatan dapat disesuaikan kembali di atas.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(true)}
                      className="py-3 px-5 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-extrabold transition-all text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-md w-full sm:w-auto cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Kosongkan Semua Data & Mulai Bimtek Baru</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Participant Card Viewer Modal */}
      {selectedParticipantForCard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 relative shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedParticipantForCard(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors bg-slate-100 hover:bg-slate-200 p-2 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 uppercase tracking-wide">
                Pratinjau Kartu Digital
              </h2>
              <p className="text-xs text-slate-500 font-sans">
                Kartu peserta resmi milik {selectedParticipantForCard.name}
              </p>
            </div>

            {/* Rendering the ParticipantCard inside */}
            <div className="flex-1 flex flex-col items-center space-y-6 py-2" id="single-participant-card-preview">
              <div className="no-print w-full flex justify-center">
                <ParticipantCard
                  registration={selectedParticipantForCard}
                  eventTitle={settings.eventTitle}
                  eventLocation={settings.eventLocation}
                  cardTemplateBase64={settings.cardTemplateBase64}
                />
              </div>

              {/* Detail KTP Section displayed large on screen inside this modal */}
              <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-800 space-y-4">
                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider block w-fit">
                  Data KTP & Kontak Peserta
                </span>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Nama Lengkap</span>
                    <span className="font-extrabold text-slate-900 uppercase block">{selectedParticipantForCard.name}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">NIK KTP</span>
                    <span className="font-mono font-bold text-slate-950 block">{selectedParticipantForCard.nik}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">No. HP / WhatsApp</span>
                    <span className="font-bold text-emerald-600 block">{selectedParticipantForCard.phone || "-"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Domisili</span>
                    <span className="font-bold text-slate-900 block">{selectedParticipantForCard.kabKota}</span>
                  </div>
                </div>
                {selectedParticipantForCard.address && (
                  <div className="text-xs border-t border-slate-200/50 pt-2">
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Alamat Lengkap</span>
                    <span className="font-medium text-slate-700 block mt-0.5">{selectedParticipantForCard.address}</span>
                  </div>
                )}
                {selectedParticipantForCard.ktpBase64 ? (
                  <div className="border-t border-slate-200/50 pt-3">
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-2">Foto KTP Peserta (Resolusi Tinggi)</span>
                    <div className="bg-white border border-slate-200/55 rounded-xl p-2.5 flex justify-center">
                      <img
                        src={selectedParticipantForCard.ktpBase64}
                        alt="Foto KTP Original"
                        className="max-h-60 max-w-full object-contain rounded-lg shadow-sm"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-slate-200/50 pt-3 text-center text-xs text-gray-400 italic">
                    Peserta mendaftar tanpa mengunggah berkas/foto KTP.
                  </div>
                )}
                {selectedParticipantForCard.signatureBase64 && (
                  <div className="border-t border-slate-200/50 pt-3 animate-fade-in">
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-2">Tanda Tangan Registrasi</span>
                    <div className="bg-white border border-slate-200/55 rounded-xl p-2.5 flex justify-center">
                      <img
                        src={selectedParticipantForCard.signatureBase64}
                        alt="Tanda Tangan Registrasi"
                        className="max-h-24 max-w-full object-contain rounded-lg"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {singlePdfStatus && (
              <div className="mt-4 text-xs font-semibold text-center py-2 bg-emerald-50 text-emerald-700 rounded-xl animate-pulse border border-emerald-100">
                {singlePdfStatus}
              </div>
            )}

            {/* Print button at the bottom */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setSelectedParticipantForCard(null)}
                className="flex-1 py-3 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 active:scale-95 transition-all text-xs sm:text-sm"
              >
                Tutup
              </button>
              <button
                onClick={() => handleDownloadSingleParticipantPDF(selectedParticipantForCard)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all text-sm flex items-center justify-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Simpan PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Detail Viewer Modal */}
      {selectedAttendanceForDetail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 relative shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-y-auto text-slate-800">
            <button
              onClick={() => setSelectedAttendanceForDetail(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors bg-slate-100 hover:bg-slate-200 p-2 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6">
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                Sesi Absensi Luring
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mt-2.5 uppercase tracking-wide">
                Hari Ke-{selectedAttendanceForDetail.day}
              </h2>
              <p className="text-xs text-slate-500 font-sans font-medium">
                {formatIndonesianDate(settings.startDate || "2026-05-21", selectedAttendanceForDetail.day - 1)}
              </p>
            </div>

            <div className="space-y-4 text-slate-700">
              <div className="border-b border-slate-100 pb-3">
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Nama Lengkap</div>
                <div className="text-sm font-extrabold text-slate-900 uppercase">
                  {selectedAttendanceForDetail.name}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3">
                <div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">NIK KTP</div>
                  <div className="text-xs font-mono font-bold text-slate-900">
                    {selectedAttendanceForDetail.nik}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">WhatsApp / HP</div>
                  <div className="text-xs font-bold text-emerald-600">
                    {selectedRegDetail?.phone || "-"}
                  </div>
                </div>
              </div>

              <div className="border-b border-slate-100 pb-3">
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Domisili Daerah</div>
                <div className="text-xs font-bold text-slate-900">
                  {selectedRegDetail?.kabKota || "-"}
                </div>
              </div>

              {selectedRegDetail?.address && (
                <div className="border-b border-slate-100 pb-3">
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Alamat Lengkap</div>
                  <div className="text-xs text-slate-600 font-medium leading-relaxed">
                    {selectedRegDetail.address}
                  </div>
                </div>
              )}

              {selectedRegDetail?.ktpBase64 && (
                <div className="border-b border-slate-100 pb-3">
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Unggahan Foto KTP</div>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-2 flex justify-center">
                    <img
                      src={selectedRegDetail.ktpBase64}
                      alt="Pratinjau KTP"
                      className="max-h-28 max-w-full object-contain rounded-xl border border-slate-200/50"
                    />
                  </div>
                </div>
              )}

              <div>
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Tanda Tangan Digital</div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-center h-28 relative">
                  {selectedAttendanceForDetail.signatureBase64 ? (
                    <img
                      src={selectedAttendanceForDetail.signatureBase64}
                      alt="Pratinjau TTD"
                      className="max-h-full max-w-full object-contain mix-blend-multiply"
                    />
                  ) : (
                    <span className="text-xs text-gray-400 italic">Tidak ada pratinjau tanda tangan</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedAttendanceForDetail(null)}
                className="w-full py-3 bg-semibold bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl active:scale-95 transition-all text-sm shadow-md cursor-pointer"
              >
                Tutup Detail Absensi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Reset Confirm Modal Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-3xl w-full max-w-md p-6 relative shadow-2xl text-slate-100 animate-fade-in">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-red-950 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-wide">
                Konfirmasi Kosongkan Sistem
              </h3>
              <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">
                Apakah Anda benar-benar yakin ingin menghapus seluruh data pendaftar dan daftar kehadiran untuk memulai Bimtek Baru?
              </p>
            </div>

            <div className="bg-slate-950/50 rounded-2xl p-4 border border-white/5 space-y-2.5 text-xs text-slate-300">
              <p className="flex items-start gap-2">
                <span className="text-red-500">⮚</span>
                <span>Seluruh daftar peserta pendaftar ({registrations.length} orang) akan di-wipe secara permanen di server & database lokal.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-red-500">⮚</span>
                <span>Seluruh log dokumen absensi ({attendance.length} baris) akan ditiadakan.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-red-500">⮚</span>
                <span>Seluruh berkas unggahan KTP dan tanda tangan digital akan dibersihkan.</span>
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button
                disabled={isResetting}
                onClick={async () => {
                  setIsResetting(true);
                  try {
                    await onResetAllData();
                    setShowResetConfirm(false);
                    setShowResetSuccess(true);
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setIsResetting(false);
                  }
                }}
                className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-850 text-white font-extrabold rounded-xl transition-all text-sm shadow-md uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
              >
                {isResetting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Database className="w-4 h-4" />
                )}
                <span>Ya, Hapus Permanen & Mulai Baru</span>
              </button>
              
              <button
                disabled={isResetting}
                onClick={() => setShowResetConfirm(false)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl transition-all text-sm outline-none cursor-pointer"
              >
                Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Reset Success Modal */}
      {showResetSuccess && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 text-center relative shadow-2xl border border-slate-100 text-slate-800 animate-fade-in">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">
              Sistem Berhasil Dikosongkan!
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Seluruh data pendaftaran dan log absensi mandiri telah dikosongkan total di database server (Firebase Firestore) dan cache lokal browser. Sistem sekarang siap dipergunakan untuk kegiatan Bimtek selanjutnya!
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowResetSuccess(false)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md text-sm active:scale-95 transition-all outline-none cursor-pointer"
              >
                Selesai & Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
