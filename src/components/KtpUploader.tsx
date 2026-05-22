import React, { useState, useRef } from "react";
import { UploadCloud, CheckCircle, FileUp, Loader2, Camera, FolderOpen } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface KtpUploaderProps {
  onScanComplete: (data: {
    nik: string;
    name: string;
    address: string;
    kabKota: string;
    color: string;
    ktpBase64: string;
  }) => void;
  onError: (msg: string) => void;
}

export const KtpUploader: React.FC<KtpUploaderProps> = ({ onScanComplete, onError }) => {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      onError("Berkas harus berupa gambar (JPEG, PNG, atau WEBP)");
      return;
    }

    // Limit to 10MB
    if (file.size > 10 * 1024 * 1024) {
      onError("Ukuran berkas terlalu besar. Maksimal adalah 10MB.");
      return;
    }

    setLoading(true);
    setStatusMessage("Membaca berkas gambar...");

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setPreview(base64);

      try {
        setStatusMessage("Mengekstrak data dari KTP...");
        const response = await fetch("/api/scan-ktp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            base64,
            mimeType: file.type,
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Gagal memproses gambar KTP");
        }

        setStatusMessage("Menganalisis profil data...");
        const data = await response.json();

        // Check if OCR yielded results or returned empty
        if (!data.nik || !data.name) {
          throw new Error("Gagal mendeteksi NIK atau Nama secara otomatis. Silakan masukkan data secara manual pada formulir atau unggah foto KTP ulang dengan pencahayaan yang lebih jelas.");
        }

        // Successfully scanned
        onScanComplete({
          nik: data.nik,
          name: data.name,
          address: data.address || "",
          kabKota: data.kabKota || "Tidak Terdeteksi",
          color: data.color || "#0F6251", // Fallback color
          ktpBase64: base64,
        });
      } catch (err: any) {
        console.error("OCR parse exception:", err);
        onError(err?.message || "Koneksi terputus saat memproses KTP. Silakan coba kembali.");
        setPreview(null);
      } finally {
        setLoading(false);
        setStatusMessage("");
      }
    };

    reader.onerror = () => {
      onError("Gagal membaca berkas KTP.");
      setLoading(false);
    };

    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerGalleryInput = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const triggerCameraInput = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  return (
    <div className="w-full">
      {/* Hidden input for regular file upload */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={handleChange}
        disabled={loading}
      />

      {/* Hidden input to directly capture photo from device camera */}
      <input
        ref={cameraInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        disabled={loading}
      />

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative overflow-hidden w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 transition-all duration-300 ${
          loading
            ? "border-emerald-600/30 bg-emerald-500/5"
            : dragActive
            ? "border-emerald-500 bg-emerald-500/10 scale-[1.01] shadow-lg shadow-emerald-500/10"
            : "border-gray-200 bg-slate-50/20 hover:border-emerald-500 hover:bg-slate-50/50"
        }`}
      >
        <AnimatePresence mode="wait">
          {!preview && !loading ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center text-center space-y-5"
            >
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full shadow-inner">
                <UploadCloud className="w-10 h-10 text-emerald-600" />
              </div>
              <div>
                <p className="text-base font-bold text-gray-800">
                  Ambil Foto atau Unggah KTP Anda
                </p>
                <p className="text-xs text-gray-500 mt-1 max-w-sm">
                  Silakan pilih opsi pengambilan foto KTP di bawah ini untuk memulai pengisian data secara otomatis.
                </p>
              </div>

              {/* ACTION CHOICES: CAMERA OR UPLOAD FILE */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2 w-full max-w-md justify-center">
                <button
                  type="button"
                  onClick={triggerCameraInput}
                  className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-emerald-600/10"
                >
                  <Camera className="w-4 h-4" />
                  <span>Ambil Foto KTP (Kamera)</span>
                </button>
                <button
                  type="button"
                  onClick={triggerGalleryInput}
                  className="flex items-center justify-center space-x-2 bg-white hover:bg-slate-50 text-gray-700 font-bold px-4 py-2.5 rounded-xl text-xs transition-all active:scale-95 border border-gray-200 shadow-sm"
                >
                  <FolderOpen className="w-4 h-4 text-gray-500" />
                  <span>Pilih File KTP (Galeri)</span>
                </button>
              </div>
            </motion.div>
          ) : loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center text-center space-y-6 py-6"
            >
              <div className="relative flex items-center justify-center">
                <Loader2 className="w-14 h-14 text-emerald-600 animate-spin" />
                <FileUp className="w-6 h-6 text-emerald-700 absolute" />
              </div>
              <div className="space-y-2">
                <p className="text-base font-bold text-emerald-800 animate-pulse">
                  Sedang Pemrosesan Dokumen...
                </p>
                <p className="text-xs text-gray-600 max-w-xs">
                  {statusMessage}
                </p>
              </div>

              {preview && (
                <div className="w-44 h-28 overflow-hidden rounded-xl border border-emerald-500/20 shadow-md opacity-40">
                  <img src={preview} alt="Scanning preview" className="w-full h-full object-cover" />
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center space-y-4"
            >
              <div className="w-52 h-32 rounded-xl overflow-hidden border-2 border-emerald-600 shadow-md relative">
                <img src={preview!} alt="KTP preview" className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 bg-emerald-600 text-white rounded-full p-1 opacity-90 shadow">
                  <CheckCircle className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800 font-sans">KTP Berhasil Dimuat</p>
                <p className="text-xs text-gray-500 mt-1">Ingin mengulang? Pilih opsi di bawah ini:</p>
              </div>

              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={triggerCameraInput}
                  className="flex items-center space-x-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Kamera</span>
                </button>
                <button
                  type="button"
                  onClick={triggerGalleryInput}
                  className="flex items-center space-x-1 text-xs text-slate-700 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-slate-50"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-gray-500" />
                  <span>Galeri</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
