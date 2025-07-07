import {
  ArrowPathIcon,
  CommandLineIcon,
  EyeIcon,
  ListBulletIcon,
} from "@heroicons/react/24/outline";
import { useMediaQuery } from "@site/src/hooks/use-media-query";
import { motion } from "framer-motion";
import React, { useState } from "react";
import AgentChat from "./AgentChat";
import AgentDetailView from "./AgentDetailView";
import AgentListView from "./AgentListView";
import FlowOverview from "./FlowOverview";
import ImageModal from "./ImageModal";

interface ModalImage {
  src: string;
  alt: string;
}

const ObservabilityFeatures = () => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [modalImage, setModalImage] = useState<ModalImage | null>(null);

  const getResponsiveText = (mobileText: string, desktopText: string) => {
    return isMobile ? mobileText : desktopText;
  };

  const openModal = (imageSrc: string, imageAlt: string) => {
    setModalImage({ src: imageSrc, alt: imageAlt });
  };

  const closeModal = () => {
    setModalImage(null);
  };

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 landing-xs:px-3 landing-sm:px-6 mb-6 landing-xs:mb-4 landing-sm:mb-8 landing-md:mb-12 landing-lg:mb-16">
        <div className="text-left">
          <h2 className="text-lg landing-xs:text-base landing-sm:text-xl landing-md:text-2xl landing-lg:text-3xl text-emerald-500 font-bold mb-3 landing-xs:mb-2 landing-sm:mb-4">
            AI Agent Observability Matters
          </h2>
          <p className="text-gray-400 max-w-3xl text-sm landing-xs:text-xs landing-sm:text-base landing-md:text-lg mb-3 landing-xs:mb-2 landing-sm:mb-4">
            Without proper observability, debugging and managing agent behavior
            becomes overwhelming.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 landing-xs:px-3 landing-sm:px-6">
        <div className="grid grid-cols-1 landing-md:grid-cols-2 gap-3 landing-xs:gap-2 landing-sm:gap-4 landing-md:gap-6">
          <div className="flex flex-col gap-3 landing-xs:gap-2 landing-sm:gap-4 landing-md:gap-6">
            {/* Connection Management Card */}
            <motion.div
              className="rounded-md border-2 border-solid border-gray-800/50 hover:border-emerald-500 transition-all duration-300 overflow-hidden h-auto"
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div
                className="p-2 landing-xs:p-2 landing-sm:p-3 landing-md:p-4 border-b border-white/10 bg-[#191c24]"
                style={{
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                }}
              >
                <div className="flex items-start gap-2 landing-xs:gap-2 landing-sm:gap-3 landing-md:gap-4">
                  <div className="bg-emerald-400/10 w-5 h-5 landing-xs:w-5 landing-xs:h-5 landing-sm:w-6 landing-sm:h-6 landing-md:w-8 landing-md:h-8 landing-lg:w-10 landing-lg:h-10 rounded-md flex items-center justify-center shrink-0">
                    <ArrowPathIcon className="w-2.5 h-2.5 landing-xs:w-2.5 landing-xs:h-2.5 landing-sm:w-3 landing-sm:h-3 landing-md:w-4 landing-md:h-4 landing-lg:w-5 landing-lg:h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 text-xs landing-xs:text-xs landing-sm:text-sm landing-md:text-base landing-lg:text-lg font-semibold text-white">
                      n8n-style observability
                    </div>
                    <p className="text-gray-400 text-xs landing-xs:text-xs landing-sm:text-sm mb-0 leading-relaxed">
                      {getResponsiveText(
                        "Visualize and debug AI agents from any framework in real-time.",
                        "Visualize and debug AI agents from any framework in real-time.",
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <FlowOverview
                  onImageClick={() =>
                    openModal("/img/ops/flow-1.png", "Connection Manager")
                  }
                />
              </div>
            </motion.div>

            {/* Message Inspector Card */}
            <motion.div
              className="rounded-md border-2 border-solid border-gray-800/50 hover:border-emerald-500 transition-all duration-300 overflow-hidden h-auto"
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div
                className="p-2 landing-xs:p-2 landing-sm:p-3 landing-md:p-4 border-b border-white/10 bg-[#191c24]"
                style={{
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                }}
              >
                <div className="flex items-start gap-2 landing-xs:gap-2 landing-sm:gap-3 landing-md:gap-4">
                  <div className="bg-emerald-400/10 w-5 h-5 landing-xs:w-5 landing-xs:h-5 landing-sm:w-6 landing-sm:h-6 landing-md:w-8 landing-md:h-8 landing-lg:w-10 landing-lg:h-10 rounded-md flex items-center justify-center shrink-0">
                    <CommandLineIcon className="w-2.5 h-2.5 landing-xs:w-2.5 landing-xs:h-2.5 landing-sm:w-3 landing-sm:h-3 landing-md:w-4 landing-md:h-4 landing-lg:w-5 landing-lg:h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 text-xs landing-xs:text-xs landing-sm:text-sm landing-md:text-base landing-lg:text-lg font-semibold text-white">
                      Universal Agent Communication
                      <span className="text-xs text-gray-400 font-normal ml-2">
                        (in supported platforms)
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs landing-xs:text-xs landing-sm:text-sm  mb-0 leading-relaxed">
                      {getResponsiveText(
                        "Chat with your AI agents in real-time.",
                        "Chat with your AI agents, with metrics and insights.",
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <AgentChat
                  onImageClick={() =>
                    openModal("/img/ops/agent-chat.png", "Message Inspector")
                  }
                />
              </div>
            </motion.div>
          </div>

          <div className="flex flex-col gap-3 landing-xs:gap-2 landing-sm:gap-4 landing-md:gap-6 mt-3 landing-xs:mt-2 landing-sm:mt-4 landing-md:mt-0">
            {/* Agent Detail View Card */}
            <motion.div
              className="rounded-md border-2 border-solid border-gray-800/50 hover:border-emerald-500 transition-all duration-300 overflow-hidden h-auto"
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div
                className="p-2 landing-xs:p-2 landing-sm:p-3 landing-md:p-4 border-b border-white/10 bg-[#191c24]"
                style={{
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                }}
              >
                <div className="flex items-start gap-2 landing-xs:gap-2 landing-sm:gap-3 landing-md:gap-4">
                  <div className="bg-emerald-400/10 w-5 h-5 landing-xs:w-5 landing-xs:h-5 landing-sm:w-6 landing-sm:h-6 landing-md:w-8 landing-md:h-8 landing-lg:w-10 landing-lg:h-10 rounded-md flex items-center justify-center shrink-0">
                    <EyeIcon className="w-2.5 h-2.5 landing-xs:w-2.5 landing-xs:h-2.5 landing-sm:w-3 landing-sm:h-3 landing-md:w-4 landing-md:h-4 landing-lg:w-5 landing-lg:h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 text-xs landing-xs:text-xs landing-sm:text-sm landing-md:text-base landing-lg:text-lg font-semibold text-white">
                      Granular Monitoring
                    </div>
                    <p className="text-gray-400 text-xs landing-xs:text-xs landing-sm:text-sm mb-0 leading-relaxed">
                      {getResponsiveText(
                        "View detailed inputs, outputs, and parameters regardless of framework.",
                        "Inputs, outputs, and parameters for any agent, memory, and tool call.",
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <AgentDetailView
                  onImageClick={() =>
                    openModal("/img/ops/flow-detail-2.png", "Agent Detail")
                  }
                />
              </div>
            </motion.div>

            {/* Agent List View Card */}
            <motion.div
              className="rounded-md border-2 border-solid border-gray-800/50 hover:border-emerald-500 transition-all duration-300 overflow-hidden h-auto"
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div
                className="p-2 landing-xs:p-2 landing-sm:p-3 landing-md:p-4 border-b border-white/10 bg-[#191c24]"
                style={{
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                }}
              >
                <div className="flex items-start gap-2 landing-xs:gap-2 landing-sm:gap-3 landing-md:gap-4">
                  <div className="bg-emerald-400/10 w-5 h-5 landing-xs:w-5 landing-xs:h-5 landing-sm:w-6 landing-sm:h-6 landing-md:w-8 landing-md:h-8 landing-lg:w-10 landing-lg:h-10 rounded-md flex items-center justify-center shrink-0">
                    <ListBulletIcon className="w-2.5 h-2.5 landing-xs:w-2.5 landing-xs:h-2.5 landing-sm:w-3 landing-sm:h-3 landing-md:w-4 landing-md:h-4 landing-lg:w-5 landing-lg:h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 text-xs landing-xs:text-xs landing-sm:text-sm landing-md:text-base landing-lg:text-lg font-semibold text-white">
                      Agent List View
                    </div>
                    <p className="text-gray-400 text-xs landing-xs:text-xs landing-sm:text-sm  mb-0 leading-relaxed">
                      {getResponsiveText(
                        "View active and completed agent sessions.",
                        "Displays a list of active or recent agent sessions for quick overview.",
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <AgentListView
                onImageClick={() =>
                  openModal("/img/ops/agent-list.png", "Agent Sessions List")
                }
              />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      <ImageModal
        isOpen={modalImage !== null}
        onClose={closeModal}
        imageSrc={modalImage?.src || ""}
        imageAlt={modalImage?.alt || ""}
      />
    </>
  );
};

export default ObservabilityFeatures;
