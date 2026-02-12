import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  SafeAreaView,
  Alert,
} from "react-native";
import { Send, X, Loader2, Stethoscope, Activity, MessageCircle } from "lucide-react-native";
import { MotiView } from "moti";
import Constants from "expo-constants";
import api from "@/services/api"; // Import the centralized API service

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "👋 Hello! I'm the Care101 Virtual Assistant. I can help you find a specialist, check symptoms, or get hospital info. How can I help you today?",
    },
  ]);

  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, loading, isOpen]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    const newHistory = [...messages, userMessage];

    setMessages(newHistory);
    setInput("");
    setLoading(true);

    try {
      // Use the centralized API service to call our backend
      // This ensures we use the backend's system prompt and logic (Gemini)
      const res = await api.post("/chat", {
        messages: newHistory
      });

      const reply = res.data.reply;

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply }
      ]);

    } catch (error: any) {
      console.error("Chat Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Sorry, something went wrong. ${error.response?.data?.error || error.message || 'Please try again.'}`
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* --- FLOATING HOSPITAL BUTTON --- */}
      {!isOpen && (
        <MotiView
          from={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 15 }}
          // ✅ FIX: Changed 'bottom-6' to 'bottom-24' to raise it above the tab bar
          className="absolute bottom-24 right-6 z-50"
        >
          <TouchableOpacity
            onPress={() => setIsOpen(true)}
            activeOpacity={0.8}
            className="relative h-16 w-16 rounded-full bg-cyan-600 shadow-xl flex items-center justify-center border-4 border-white"
            style={{ elevation: 5 }} // Shadow for Android
          >
            {/* Logo Logic */}
            <View className="h-8 w-8 items-center justify-center">
              {/* Note: If this is a local asset, use require() instead of uri string */}
              {/* Example: source={require('../../assets/images/icon.png')} */}
              <Image
                source={require('../../assets/images/icon3.png')}
                className="h-full w-full"
                resizeMode="contain"
              />
            </View>

            {/* Heartbeat Animation Ring (Ping effect) */}
            <MotiView
              from={{ opacity: 0.7, scale: 1 }}
              animate={{ opacity: 0, scale: 1.5 }}
              transition={{
                type: "timing",
                duration: 2000,
                loop: true,
                repeatReverse: false,
              }}
              className="absolute -inset-1 rounded-full border-2 border-cyan-400"
            />

            {/* Status Dot */}
            <View className="absolute top-0 right-0 h-4 w-4 bg-green-500 border-2 border-white rounded-full" />
          </TouchableOpacity>
        </MotiView>
      )}

      {/* --- CHAT MODAL --- */}
      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade" // Changed from 'slide' to 'fade' for smoother custom animation
        onRequestClose={() => setIsOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-end"
        >
          {/* Backdrop (Tap to close) */}
          <TouchableOpacity
            className="absolute inset-0 bg-black/40" // Slightly darker for better contrast
            activeOpacity={1}
            onPress={() => setIsOpen(false)}
          />

          <MotiView
            from={{ opacity: 0, scale: 0.9, translateY: 50 }} // Subtle pop-up instead of full slide
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            exit={{ opacity: 0, scale: 0.9, translateY: 50 }}
            transition={{ type: "timing", duration: 250 }} // Snappy 250ms transition
            className="bg-white rounded-t-3xl h-[85%] w-full shadow-2xl overflow-hidden flex flex-col"
          >
            {/* HEADER */}
            <View className="bg-cyan-600 p-4 flex-row items-center justify-between shadow-md z-10">
              <View className="flex-row items-center gap-3">
                <View className="bg-white/15 p-2 rounded-full border border-white/20">
                  <Stethoscope size={20} color="white" />
                </View>
                <View>
                  <Text className="text-base font-bold text-white tracking-wide">
                    Care101 Support
                  </Text>
                  <View className="flex-row items-center gap-1.5 opacity-90">
                    <Activity size={12} color="#E0F7FA" />
                    <Text className="text-xs text-cyan-50">Always Online</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsOpen(false)}
                className="p-2 rounded-full active:bg-white/10"
              >
                <X size={24} color="white" />
              </TouchableOpacity>
            </View>

            {/* MESSAGES AREA */}
            <ScrollView
              ref={scrollViewRef}
              className="flex-1 bg-[#F1F5F9] px-4 pt-4"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <View className="items-center mb-4">
                <View className="bg-slate-200/50 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    Today
                  </Text>
                </View>
              </View>

              {messages.map((m, index) => (
                <View
                  key={index}
                  className={`flex-row mb-4 ${m.role === "user" ? "justify-end" : "justify-start"
                    }`}
                >
                  {m.role === "assistant" && (
                    <View className="w-8 h-8 rounded-full bg-white border border-slate-200 items-center justify-center mr-2 shadow-sm">
                      <Image
                        source={require('../../assets/images/icon3.png')}
                        className="h-5 w-5"
                        resizeMode="contain"
                      />
                    </View>
                  )}

                  <View
                    className={`max-w-[80%] px-4 py-3 shadow-sm ${m.role === "user"
                      ? "bg-cyan-600 rounded-2xl rounded-tr-none"
                      : "bg-white border border-slate-200 rounded-2xl rounded-tl-none"
                      }`}
                  >
                    <Text
                      className={`text-sm leading-relaxed ${m.role === "user" ? "text-white" : "text-slate-700"
                        }`}
                    >
                      {m.content}
                    </Text>
                  </View>
                </View>
              ))}

              {loading && (
                <View className="flex-row justify-start items-center mb-4">
                  <View className="w-8 h-8 rounded-full bg-white border border-slate-200 items-center justify-center mr-2 shadow-sm">
                    {/* Rotate animation manually or use Moti. Keeping simple here. */}
                    <Loader2 size={16} color="#0891b2" />
                  </View>
                  <View className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex-row gap-1">
                    <MotiView
                      from={{ opacity: 0.4 }}
                      animate={{ opacity: 1 }}
                      transition={{ loop: true, type: 'timing', duration: 500 }}
                      className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                    />
                    <MotiView
                      from={{ opacity: 0.4 }}
                      animate={{ opacity: 1 }}
                      transition={{ loop: true, type: 'timing', duration: 500, delay: 150 }}
                      className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                    />
                    <MotiView
                      from={{ opacity: 0.4 }}
                      animate={{ opacity: 1 }}
                      transition={{ loop: true, type: 'timing', duration: 500, delay: 300 }}
                      className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                    />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* INPUT AREA */}
            <SafeAreaView className="bg-white border-t border-slate-100">
              <View className="p-4">
                <View className="flex-row gap-3 items-center">
                  <TextInput
                    value={input}
                    onChangeText={setInput}
                    placeholder="Type your health concern..."
                    placeholderTextColor="#94a3b8"
                    className="flex-1 h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-slate-800"
                    onSubmitEditing={sendMessage}
                  />
                  <TouchableOpacity
                    onPress={sendMessage}
                    disabled={loading || !input.trim()}
                    className={`h-12 w-12 items-center justify-center rounded-xl shadow-md ${loading || !input.trim() ? "bg-slate-300" : "bg-cyan-600"
                      }`}
                  >
                    <Send size={20} color="white" style={{ marginLeft: 2 }} />
                  </TouchableOpacity>
                </View>
                <View className="items-center mt-2">
                  <Text className="text-[10px] text-slate-400">
                    For medical emergencies, call{" "}
                    <Text className="font-bold text-red-500">1990</Text> immediately.
                  </Text>
                </View>
              </View>
            </SafeAreaView>
          </MotiView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}