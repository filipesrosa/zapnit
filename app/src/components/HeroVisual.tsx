"use client";

import { useState, useEffect } from "react";
import ChatMockup from "./ChatMockup";
import CodePreview from "./CodePreview";

export default function HeroVisual() {
  const [visible, setVisible] = useState<"chat" | "code">("chat");
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setVisible((v) => (v === "chat" ? "code" : "chat"));
        setFading(false);
      }, 500); // half of the CSS transition
    }, 7000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="flex justify-center lg:justify-end transition-opacity duration-500"
      style={{ opacity: fading ? 0 : 1 }}
    >
      {visible === "chat" ? <ChatMockup /> : <CodePreview />}
    </div>
  );
}
