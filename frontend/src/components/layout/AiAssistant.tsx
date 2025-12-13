"use client";

import { useState, useRef, useEffect } from "react";
import { Send, X, Loader2, Stethoscope, Activity, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = "http://localhost:5000/api/chat"; 

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "👋 Hello! I'm the Care101 Virtual Assistant. I can help you find a specialist, check symptoms, or get hospital info. How can I help you today?" }
  ]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    const newHistory = [...messages, userMessage];
    
    setMessages(newHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory }),
      });

      const data = await res.json();
      
      if (data.reply) {
        setMessages([...newHistory, { role: "assistant", content: data.reply }]);
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        throw new Error("No reply");
      }

    } catch (error: any) {
      console.error(error);
      setMessages([...newHistory, { role: "assistant", content: `⚠️ I'm currently offline. Please call our hotline at 1990 for emergencies.` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* --- FLOATING HOSPITAL BUTTON --- */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 group z-50 flex items-center gap-3"
        >
          {/* Label (Only visible on hover) */}
          <span className="bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
            Chat with Care101
          </span>

          {/* Main Button */}
          <div className="relative h-16 w-16 rounded-full bg-cyan-600 shadow-xl flex items-center justify-center border-4 border-white ring-1 ring-slate-100">
             {/* Logo / Icon */}
             {/* Replace '/logo.png' with your actual logo path if you have one */}
             <div className="h-8 w-8">
                {/* Fallback to Icon if no logo image */}
                <img 
                    src="/logo.png" 
                    alt="Logo" 
                    className="h-full w-full object-contain"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                />
                <MessageCircle className="h-full w-full text-white hidden" /> 
             </div>

            {/* Heartbeat Animation Ring */}
            <span className="absolute -inset-1 rounded-full border-2 border-cyan-400 opacity-0 animate-ping duration-[3000ms]"></span>
            
            {/* Status Dot */}
            <span className="absolute top-0 right-0 h-4 w-4 bg-green-500 border-2 border-white rounded-full"></span>
          </div>
        </motion.button>
      )}

      {/* --- CHAT INTERFACE --- */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 w-[90vw] md:w-[380px] h-[550px] z-50 flex flex-col font-sans"
          >
            <Card className="h-full shadow-2xl border-0 flex flex-col overflow-hidden rounded-2xl bg-slate-50">
              
              {/* HEADER */}
              <CardHeader className="bg-cyan-600 p-4 flex flex-row items-center justify-between shrink-0 shadow-md z-10">
                <div className="flex items-center gap-3">
                  <div className="bg-white/15 p-2 rounded-full border border-white/20 backdrop-blur-sm">
                    {/* Header Icon */}
                    <Stethoscope className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-white tracking-wide">
                      Care101 Support
                    </CardTitle>
                    <p className="text-xs text-cyan-50 flex items-center gap-1.5 opacity-90">
                      <Activity className="h-3 w-3" /> Always Online
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsOpen(false)}
                  className="text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="h-5 w-5" />
                </Button>
              </CardHeader>

              {/* MESSAGES AREA */}
              <ScrollArea className="flex-1 bg-[#F1F5F9] p-4">
                <div className="space-y-4 pb-2">
                  {/* Date Stamp */}
                  <div className="flex justify-center">
                    <span className="text-[10px] font-medium text-slate-400 bg-slate-200/50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Today
                    </span>
                  </div>

                  {messages.map((m, index) => (
                    <motion.div 
                      key={index} 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {/* Avatar for Assistant */}
                      {m.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center mr-2 shadow-sm shrink-0">
                           <img 
                              src="/logo.png" 
                              className="h-5 w-5 object-contain"
                              onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }} 
                           />
                           <Stethoscope className="h-4 w-4 text-cyan-600 hidden" />
                        </div>
                      )}
                      
                      {/* Message Bubble */}
                      <div 
                        className={`max-w-[80%] px-4 py-3 text-sm leading-relaxed shadow-sm ${
                          m.role === 'user' 
                            ? 'bg-cyan-600 text-white rounded-2xl rounded-tr-none' 
                            : 'bg-white text-slate-700 border border-slate-200 rounded-2xl rounded-tl-none'
                        }`}
                      >
                        {m.content}
                      </div>
                    </motion.div>
                  ))}

                  {/* Typing Indicator */}
                  {loading && (
                    <div className="flex justify-start items-center">
                       <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center mr-2 shadow-sm">
                           <Loader2 className="h-4 w-4 text-cyan-600 animate-spin" />
                        </div>
                        <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                        </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              </ScrollArea>

              {/* INPUT AREA */}
              <div className="p-4 bg-white border-t border-slate-100">
                <form 
                  onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                  className="flex gap-3 items-center"
                >
                  <Input 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your health concern..."
                    className="flex-1 h-11 bg-slate-50 border-slate-200 focus-visible:ring-cyan-500 rounded-xl"
                  />
                  <Button 
                    type="submit" 
                    disabled={loading || !input.trim()} 
                    size="icon"
                    className="h-11 w-11 shrink-0 bg-cyan-600 hover:bg-cyan-700 text-white shadow-md shadow-cyan-100 rounded-xl transition-all"
                  >
                    <Send className="h-5 w-5 ml-0.5" />
                  </Button>
                </form>
                <div className="text-center mt-2">
                    <p className="text-[10px] text-slate-400">
                        For medical emergencies, call <span className="font-bold text-red-500">1990</span> immediately.
                    </p>
                </div>
              </div>

            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}