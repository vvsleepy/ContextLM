import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { FileUpload } from "./components/FileUpload";
import { ChatInterface } from "./components/ChatInterface";

const API_URL = import.meta.env.VITE_API_URL || "";

interface PersistedFile {
  name: string;
  size: number;
}

function App() {
  const [uploadedFiles, setUploadedFiles] = useState<PersistedFile[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/files`);
      setUploadedFiles(res.data);
    } catch (err) {
      console.error("Failed to fetch files from backend:", err);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return (
    <main className="h-screen bg-gradient-to-br from-[#fff6fb] via-[#fdf8ff] to-[#f5f0ff] flex flex-col overflow-hidden text-neutral-700">
      {/* Top Navigation Bar */}
      <header className="flex-none px-8 py-5 bg-white/70 backdrop-blur-xl border-b border-pink-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-200 via-rose-100 to-purple-200 flex items-center justify-center shadow-md border border-white/50">
            <img
              src="/favicon.png"
              alt="ContextLM Icon"
              className="w-6 h-6 object-contain"
            />
          </div>

          <div className="flex flex-col">
            <span className="text-[17px] font-semibold tracking-tight text-neutral-800">
              ContextLM ☆
            </span>

            <span className="text-xs text-neutral-500">
              Your AI document workspace
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-pink-100 shadow-sm text-sm text-neutral-500">
          conversate with your files ۶ৎ
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Left Sidebar */}
        <aside className="w-80 lg:w-96 flex-none rounded-3xl border border-pink-100 bg-white/70 backdrop-blur-xl shadow-lg overflow-y-auto">
          <div className="p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-neutral-800 mb-1">
                Upload Documents
              </h2>

              <p className="text-sm text-neutral-500 leading-relaxed">
                Add PDFs, TXT files, or CSVs to start chatting with your notes.
              </p>
            </div>

            <FileUpload
              uploadedFiles={uploadedFiles}
              onRefresh={fetchFiles}
            />
          </div>
        </aside>

        {/* Right Content */}
        <section className="flex-1 flex flex-col rounded-3xl border border-pink-100 bg-white/70 backdrop-blur-xl shadow-lg overflow-hidden">
          <div className="px-8 py-5 border-b border-pink-100 bg-white/60 backdrop-blur-md">
            <h1 className="text-lg font-semibold text-neutral-800">
              Chat with your documents
            </h1>

            <p className="text-sm text-neutral-500 mt-1">
              Ask questions and get grounded, citation-rich answers.
            </p>
          </div>

          <div className="flex-1 overflow-hidden">
            <ChatInterface
              hasDocuments={uploadedFiles.length > 0}
              isInitialLoading={isInitialLoading}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;