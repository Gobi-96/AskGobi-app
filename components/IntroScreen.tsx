"use client";
import { motion } from "framer-motion";

export default function IntroScreen({ onTryNow }: { onTryNow: () => void }) {
  return (
    <motion.div
      key="intro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -200 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center text-center bg-[#0d0d0d] text-white"
    >
      <h1 className="text-6xl font-bold mb-4">
        <span>Ask</span>
        <span className="text-blue-500">Gobi</span>
      </h1>

      <p className="text-lg sm:text-xl text-gray-400 mb-10 px-6 max-w-lg">
        Your personal AI Q&amp;A assistant — short, crisp, and factual answers.
      </p>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onTryNow}
        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-semibold shadow-lg"
      >
        🚀 Try Now
      </motion.button>
    </motion.div>
  );
}
