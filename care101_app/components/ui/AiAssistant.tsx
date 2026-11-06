import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
  Modal,
  Keyboard,
  useWindowDimensions,
  type KeyboardEvent,
} from "react-native";
import { Send, X, Stethoscope, Activity } from "lucide-react-native";
import { MotiView, MotiText } from "moti";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const rootRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  // How much of the sheet the keyboard covers. Measured rather than assumed, because a
  // Modal is its own window: Android may or may not resize it, and iOS never does.
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: KeyboardEvent) => {
      const keyboardTop = e.endCoordinates.screenY;
      rootRef.current?.measureInWindow((_x, y, _w, h) => {
        setKeyboardOverlap(Math.max(0, y + h - keyboardTop));
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);
      });
    };
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardOverlap(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  const keyboardOpen = keyboardOverlap > 0;
  // The sheet shrinks to fit above the keyboard, but never past the status bar
  const sheetHeight = Math.min(screenHeight * 0.85, screenHeight - keyboardOverlap - insets.top - 12);

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
            accessibilityRole="button"
            accessibilityLabel="Open Care101 assistant chat"
            className="relative h-16 w-16 rounded-full bg-cyan-600 shadow-xl flex items-center justify-center border-4 border-white"
            style={{ elevation: 5 }} // Shadow for Android
          >
            {/* Logo Logic */}
            <View className="h-8 w-8 items-center justify-center">
              {/* Note: If this is a local asset, use require() instead of uri string */}
              {/* Example: source={require('../../assets/images/icon.png')} */}
              <Image
                source={require('../../assets/AIchatbot.png')}
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
        statusBarTranslucent
        onRequestClose={() => setIsOpen(false)}
      >
        {/* Lifted by exactly the part the keyboard covers, so the typing bar stays visible */}
        <View ref={rootRef} style={{ flex: 1, justifyContent: "flex-end", paddingBottom: keyboardOverlap }}>
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
            className={`bg-white w-full shadow-2xl overflow-hidden flex flex-col ${keyboardOpen ? "rounded-3xl" : "rounded-t-3xl"}`}
            style={{ height: sheetHeight }}
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
                accessibilityRole="button"
                accessibilityLabel="Close chat"
              >
                <X size={24} color="white" />
              </TouchableOpacity>
            </View>

            {/* MESSAGES AREA */}
            <ScrollView
              ref={scrollViewRef}
              className="flex-1 bg-[#F1F5F9] px-4 pt-4"
              contentContainerStyle={{ paddingBottom: 20 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <View className="items-center mb-4">
                <View className="bg-slate-200/50 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    Today
                  </Text>
                </View>
              </View>

              {messages.map((m, index) => (
                <MotiView
                  key={index}
                  // New messages drift up and come into focus
                  from={{ opacity: 0, translateY: 10, scale: 0.97 }}
                  animate={{ opacity: 1, translateY: 0, scale: 1 }}
                  transition={{ type: "timing", duration: 280 }}
                  className={`flex-row mb-4 ${m.role === "user" ? "justify-end" : "justify-start"
                    }`}
                >
                  {m.role === "assistant" && (
                    <View className="w-8 h-8 rounded-full bg-white border border-slate-200 items-center justify-center mr-2 shadow-sm">
                      <Image
                        source={require('../../assets/AIchatbot.png')}
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
                </MotiView>
              ))}

              {loading && <TypingIndicator />}
            </ScrollView>

            {/* INPUT AREA */}
            <View
              className="bg-white border-t border-slate-100"
              style={{ paddingBottom: keyboardOpen ? 0 : insets.bottom }}
            >
              <View className="p-4">
                <View className="flex-row gap-3 items-center">
                  <TextInput
                    value={input}
                    onChangeText={setInput}
                    placeholder="Type your health concern..."
                    placeholderTextColor="#94a3b8"
                    className="flex-1 h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-slate-800"
                    onSubmitEditing={sendMessage}
                    returnKeyType="send"
                    accessibilityLabel="Message to Care101 assistant"
                  />
                  <TouchableOpacity
                    onPress={sendMessage}
                    disabled={loading || !input.trim()}
                    accessibilityRole="button"
                    accessibilityLabel="Send message"
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
            </View>
          </MotiView>
        </View>
      </Modal>
    </>
  );
}
// "Assistant is typing": three dots rising in a wave, each with a soft glow that blooms and
// fades (a blur-like halo), plus a gently pulsing caption.
function TypingIndicator() {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8, scale: 0.96 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: "timing", duration: 250 }}
      className="flex-row justify-start items-end mb-4"
      accessibilityLabel="Assistant is typing"
      accessibilityLiveRegion="polite"
    >
      <View className="w-8 h-8 rounded-full bg-white border border-slate-200 items-center justify-center mr-2 shadow-sm">
        <Image source={require("../../assets/AIchatbot.png")} className="h-5 w-5" resizeMode="contain" />
      </View>
      <View>
        <View className="bg-white border border-slate-200 px-4 py-3.5 rounded-2xl rounded-tl-none shadow-sm flex-row items-center" style={{ gap: 7 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: 9, height: 9, alignItems: "center", justifyContent: "center" }}>
              {/* Glow halo: grows and fades out like a blur */}
              <MotiView
                from={{ opacity: 0.45, scale: 0.6 }}
                animate={{ opacity: 0, scale: 2.4 }}
                transition={{ type: "timing", duration: 1100, loop: true, repeatReverse: false, delay: i * 180 }}
                style={{ position: "absolute", width: 9, height: 9, borderRadius: 5, backgroundColor: "#22d3ee" }}
              />
              {/* Dot: rises, sharpens and brightens, then settles */}
              <MotiView
                from={{ translateY: 2, opacity: 0.35, scale: 0.8 }}
                animate={{ translateY: -4, opacity: 1, scale: 1.1 }}
                transition={{ type: "timing", duration: 450, loop: true, delay: i * 180 }}
                style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#0891b2", shadowColor: "#06b6d4", shadowOpacity: 0.6, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }}
              />
            </View>
          ))}
        </View>
        <MotiText
          from={{ opacity: 0.35 }}
          animate={{ opacity: 0.9 }}
          transition={{ type: "timing", duration: 900, loop: true }}
          className="text-[10px] text-slate-400 mt-1 ml-1"
        >
          Care101 is typing…
        </MotiText>
      </View>
    </MotiView>
  );
}
