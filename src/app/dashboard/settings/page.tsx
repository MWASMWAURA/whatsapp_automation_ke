"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Smartphone,
  Bell,
  Trash2,
  QrCode,
  Loader2,
  User,
  Phone,
  Bot,
  Plus,
  Edit,
  Trash,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { QRCodeCanvas } from "qrcode.react";
import { useUser } from "@/lib/user-context";

export default function SettingsPage() {
  const { user, updateProfile } = useUser();
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [autoDelete, setAutoDelete] = useState(false);
  const [notifications, setNotifications] = useState({
    campaignComplete: true,
    deliveryFailed: true,
    weeklyReport: false,
    campaignReminders: true,
  });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>("disconnected");
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [faqs, setFaqs] = useState<any[]>([]);
  const [showAddFAQ, setShowAddFAQ] = useState(false);
  const [newFAQ, setNewFAQ] = useState({
    question: "",
    answer: "",
    category: "General",
  });

  // Check for existing session on component mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const response = await fetch("/api/session-status");
        const data = await response.json();

        if (
          data.hasClient &&
          (data.status === "connected" ||
            data.status === "isLogged" ||
            data.status === "inChat")
        ) {
          setWhatsappConnected(true);
          setSessionStatus("connected");
          console.log(
            "Existing WhatsApp session found with status:",
            data.status
          );
        } else {
          setWhatsappConnected(false);
          setSessionStatus(data.status || "disconnected");
        }
      } catch (error) {
        console.error("Error checking session status:", error);
        setSessionStatus("disconnected");
      }
    };

    checkExistingSession();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let timeout: NodeJS.Timeout | null = null;
    let startTime = Date.now();

    if (isConnecting) {
      // Set a timeout to stop polling after 15 minutes for SaaS development
      timeout = setTimeout(() => {
        console.error("QR code polling timed out after 15 minutes");
        setIsConnecting(false);
        setSessionStatus("error");
        alert(
          "Connection timed out. For SaaS deployment, consider using a hosted WhatsApp service or containerized browser environment."
        );
      }, 15 * 60 * 1000); // 15 minutes for development

      interval = setInterval(async () => {
        try {
          const response = await fetch("/api/qr");
          const data = await response.json();
          console.log("🔍 DEBUG: Polling /api/qr response:", data);

          if (!data.qr) {
            console.log("No QR received");
            setQrCode(null);
            setSessionStatus(data.status || "connecting");
            return;
          }

          // We have QR code
          setQrCode(data.qr);
          setSessionStatus(data.status);

          // Extract the QR code string from the response
          let qrString = data.qr;
          console.log("Raw QR data from backend:", data.qr);
          if (typeof data.qr === "string") {
            qrString = data.qr;
          } else if (data.qr && typeof data.qr === "object" && data.qr.code) {
            qrString = data.qr.code;
          }

          setQrCode(qrString);
          console.log(
            "Final QR code set to:",
            qrString,
            "startsWith data:image:",
            qrString.startsWith("data:image/")
          );
          setSessionStatus(data.status);

          // Clear the timeout since we got a valid response
          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }

          // Normalize backend statuses and update UI accordingly.
          // Some wppconnect versions return 'isLogged' or 'inChat' when the session is active.
          // Treat these as connected states so the frontend stops showing "Syncing"
          // when the phone is already active.
          if (
            data.status === "connected" ||
            data.status === "isLogged" ||
            data.status === "inChat"
          ) {
            setWhatsappConnected(true);
            setIsConnecting(false);
            setIsScanning(false);
            setQrCode(null);
            setSessionStatus("connected");
          } else if (data.status === "qrReadSuccess") {
            // QR was read but client may still be syncing
            setIsScanning(true);
            setSessionStatus("syncing");
          }
        } catch (error) {
          console.error("Error fetching QR:", error);
          // Don't stop polling on individual fetch errors - continue trying
          setSessionStatus("connecting");
        }
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [isConnecting]);

  useEffect(() => {
    const fetchFAQs = async () => {
      try {
        const response = await fetch("/api/faqs");
        if (response.ok) {
          const data = await response.json();
          setFaqs(data);
        }
      } catch (error) {
        console.error("Failed to fetch FAQs:", error);
      }
    };

    fetchFAQs();
  }, []);

  const handleConnectWhatsapp = async () => {
    // If already connected, offer to reconnect
    if (whatsappConnected) {
      if (
        !confirm("WhatsApp is already connected. Do you want to reconnect?")
      ) {
        return;
      }
      // Reset state for reconnection
      setWhatsappConnected(false);
      setSessionStatus("disconnected");
    }

    setIsConnecting(true);
    setSessionStatus("connecting");

    try {
      const response = await fetch("/api/start-session", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        // Check if client already exists
        if (
          data.status &&
          (data.status === "connected" ||
            data.status === "isLogged" ||
            data.status === "inChat")
        ) {
          // Client already exists and is connected
          setWhatsappConnected(true);
          setSessionStatus("connected");
          setIsConnecting(false);
          console.log("Client already connected with status:", data.status);
        } else {
          // Start polling for QR code (new session) - continue even if initial response is not perfect
          console.log("Starting new session, polling for QR code");
          setSessionStatus("connecting");
        }
      } else {
        // Don't stop connecting - the backend might still be trying
        console.warn(
          "Initial session start failed, but continuing to poll for QR code"
        );
        setSessionStatus("connecting");
        // Keep isConnecting true to continue polling
      }
    } catch (error) {
      console.error("Error starting session:", error);
      // Don't show alert that stops connection - continue polling
      console.warn("Network error, but continuing to poll for QR code");
      setSessionStatus("connecting");
      // Keep isConnecting true to continue polling
    }
  };

  const handleDisconnectWhatsapp = async () => {
    if (!confirm("Are you sure you want to disconnect WhatsApp?")) {
      return;
    }

    try {
      const response = await fetch("/api/disconnect-session", {
        method: "POST",
      });
      if (response.ok) {
        setWhatsappConnected(false);
        setSessionStatus("disconnected");
        setQrCode(null);
        alert("WhatsApp disconnected successfully");
      } else {
        alert("Failed to disconnect");
      }
    } catch (error) {
      console.error("Error disconnecting:", error);
      alert("Error disconnecting from backend");
    }
  };

  const handleDeleteSession = async () => {
    if (
      !confirm(
        "Are you sure you want to delete the corrupted session? This will remove all session data and you'll need to scan a new QR code."
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/delete-session", {
        method: "POST",
      });
      if (response.ok) {
        alert(
          "Session deleted successfully. You can now try connecting again."
        );
        setQrCode(null);
        setSessionStatus("disconnected");
      } else {
        alert("Failed to delete session");
      }
    } catch (error) {
      console.error("Error deleting session:", error);
      alert("Error deleting session from backend");
    }
  };

  const handleUpdateProfile = () => {
    updateProfile({
      name: profileData.name,
      email: profileData.email,
      phone: profileData.phone,
    });
    alert("Profile updated successfully!");
  };

  const handleAddFAQ = async () => {
    if (!newFAQ.question.trim() || !newFAQ.answer.trim()) {
      alert("Please fill in both question and answer");
      return;
    }

    try {
      const response = await fetch("/api/faqs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newFAQ),
      });

      if (response.ok) {
        const faq = await response.json();
        setFaqs([...faqs, faq]);
        setNewFAQ({ question: "", answer: "", category: "General" });
        setShowAddFAQ(false);
      } else {
        alert("Failed to add FAQ");
      }
    } catch (error) {
      console.error("Error adding FAQ:", error);
      alert("Error adding FAQ");
    }
  };

  const handleDeleteFAQ = async (id: string) => {
    if (!confirm("Are you sure you want to delete this FAQ?")) return;

    try {
      const response = await fetch(`/api/faqs?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setFaqs(faqs.filter((faq) => faq.id !== id));
      } else {
        alert("Failed to delete FAQ");
      }
    } catch (error) {
      console.error("Error deleting FAQ:", error);
      alert("Error deleting FAQ");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-2">
          Manage your profile, WhatsApp connection, and preferences.
        </p>
      </div>

      {/* User Profile */}
      {user && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
        >
          <div className="flex items-center mb-6">
            <User className="w-6 h-6 text-blue-600 mr-3" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                User Profile
              </h2>
              <p className="text-slate-600">
                Update your personal information and contact details
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) =>
                    setProfileData({ ...profileData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) =>
                    setProfileData({ ...profileData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) =>
                    setProfileData({ ...profileData, phone: e.target.value })
                  }
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="+1234567890"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Required for campaign scheduling reminders via WhatsApp
              </p>
            </div>
            <Button
              onClick={handleUpdateProfile}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Update Profile
            </Button>
          </div>
        </motion.div>
      )}

      {/* WhatsApp Connection */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Smartphone className="w-6 h-6 text-blue-600 mr-3" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                WhatsApp Connection
              </h2>
              <p className="text-slate-600">
                Connect your WhatsApp Business account
              </p>
            </div>
          </div>
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              sessionStatus === "connected"
                ? "bg-green-100 text-green-800"
                : sessionStatus === "syncing" || isScanning
                ? "bg-blue-100 text-blue-800"
                : sessionStatus === "connecting" || isConnecting
                ? "bg-yellow-100 text-yellow-800"
                : sessionStatus === "error"
                ? "bg-red-100 text-red-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {sessionStatus === "connected"
              ? "Connected"
              : sessionStatus === "syncing" || isScanning
              ? "Syncing..."
              : sessionStatus === "connecting" || isConnecting
              ? "Connecting..."
              : "Disconnected"}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="font-medium text-slate-900">Session Status</p>
              <p className="text-sm text-slate-600">
                {sessionStatus === "connected"
                  ? "✅ Connected - Ready to send messages"
                  : sessionStatus === "syncing" || isScanning
                  ? "🔄 Syncing with WhatsApp... Please wait"
                  : sessionStatus === "connecting" || isConnecting
                  ? "🔄 Connecting to WhatsApp..."
                  : sessionStatus === "error"
                  ? "❌ Connection failed - Please check your browser setup and try again"
                  : sessionStatus === "qrReadError"
                  ? "❌ Connection failed - QR code expired. Please try connecting again"
                  : sessionStatus === "browserClose"
                  ? "⚠️ Connection interrupted. Please reconnect"
                  : "❌ No active session - Connect to start sending messages"}
              </p>
              {sessionStatus === "qrReadError" && (
                <p className="text-xs text-amber-600 mt-1">
                  💡 Tip: Make sure to scan the QR code within 5 minutes
                </p>
              )}
              {sessionStatus === "syncing" && (
                <p className="text-xs text-blue-600 mt-1">
                  🔄 Loading your chats and contacts...
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleConnectWhatsapp}
                disabled={isConnecting}
                variant={sessionStatus === "connected" ? "outline" : "default"}
                className={
                  sessionStatus === "connected"
                    ? ""
                    : "bg-blue-600 hover:bg-blue-700"
                }
              >
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <QrCode className="w-4 h-4 mr-2" />
                )}
                {isConnecting
                  ? "Connecting..."
                  : sessionStatus === "connected"
                  ? "Reconnect"
                  : "Connect WhatsApp"}
              </Button>
              {sessionStatus === "connected" && (
                <Button
                  onClick={handleDisconnectWhatsapp}
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  Disconnect
                </Button>
              )}
              {sessionStatus === "disconnected" && (
                <Button
                  onClick={handleDeleteSession}
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Session
                </Button>
              )}
            </div>
          </div>

          {qrCode && (
            <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-3 text-center">
                🔗 Connect WhatsApp
              </h3>
              <p className="text-sm text-blue-800 mb-6 text-center">
                Open WhatsApp on your phone → Tap the menu (⋮) → Linked Devices
                → Link a Device
              </p>
              <div className="flex justify-center">
                <div className="text-center">
                  <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-blue-300 inline-block">
                    {/* Display QR code - either as image (data URL) or canvas (raw data) */}
                    {qrCode && qrCode.startsWith("data:image/") ? (
                      <img src={qrCode} alt="WhatsApp QR Code" />
                    ) : (
                      <QRCodeCanvas value={qrCode} size={320} />
                    )}
                  </div>
                  <div className="mt-4 space-y-2">
                    {qrCode === "QR_TOO_LARGE_CHECK_TERMINAL" ? (
                      <div className="space-y-2">
                        <p className="text-sm text-amber-700 font-medium">
                          ⚠️ QR Code Unavailable in Browser
                        </p>
                        <p className="text-xs text-amber-600">
                          Contact your administrator to get the scannable QR
                          code from the server.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-blue-700 font-medium">
                          📱 Scan this QR code with WhatsApp
                        </p>
                        <p className="text-xs text-blue-600">
                          The QR code will expire in 5 minutes. If it doesn't
                          work, try refreshing.
                        </p>
                        <Button
                          onClick={() => window.location.reload()}
                          variant="outline"
                          size="sm"
                          className="mt-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                        >
                          🔄 Refresh QR Code
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Auto-delete sessions</p>
              <p className="text-sm text-slate-600">
                Automatically delete inactive sessions after 7 days
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoDelete}
                onChange={(e) => setAutoDelete(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
      >
        <div className="flex items-center mb-6">
          <Bell className="w-6 h-6 text-blue-600 mr-3" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Notifications
            </h2>
            <p className="text-slate-600">
              Choose what notifications you want to receive
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(notifications).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 capitalize">
                  {key.replace(/([A-Z])/g, " $1").toLowerCase()}
                </p>
                <p className="text-sm text-slate-600">
                  {key === "campaignComplete" &&
                    "Get notified when campaigns finish sending"}
                  {key === "deliveryFailed" &&
                    "Alert when messages fail to deliver"}
                  {key === "weeklyReport" &&
                    "Receive weekly performance summaries"}
                  {key === "campaignReminders" &&
                    "Receive WhatsApp reminders for scheduled campaigns (24h, 6h, 10min, 5min before)"}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) =>
                    setNotifications({
                      ...notifications,
                      [key]: e.target.checked,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </motion.div>

      {/* AI Training */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Bot className="w-6 h-6 text-blue-600 mr-3" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                AI Training
              </h2>
              <p className="text-slate-600">
                Train your AI assistant with FAQs and responses
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowAddFAQ(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add FAQ
          </Button>
        </div>

        <div className="space-y-4">
          {faqs.length > 0 ? (
            faqs.map((faq) => (
              <div
                key={faq.id}
                className="p-4 bg-slate-50 rounded-lg border border-slate-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900 mb-2">
                      {faq.question}
                    </h3>
                    <p className="text-slate-600 text-sm mb-2">{faq.answer}</p>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {faq.category}
                    </span>
                  </div>
                  <Button
                    onClick={() => handleDeleteFAQ(faq.id)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-slate-500 py-8">
              <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>
                No FAQs added yet. Add some questions and answers to train your
                AI assistant.
              </p>
            </div>
          )}
        </div>

        {/* Add FAQ Modal */}
        {showAddFAQ && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  Add FAQ
                </h3>
                <button
                  onClick={() => setShowAddFAQ(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Question
                  </label>
                  <input
                    type="text"
                    value={newFAQ.question}
                    onChange={(e) =>
                      setNewFAQ({ ...newFAQ, question: e.target.value })
                    }
                    placeholder="Enter the question..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Answer
                  </label>
                  <textarea
                    value={newFAQ.answer}
                    onChange={(e) =>
                      setNewFAQ({ ...newFAQ, answer: e.target.value })
                    }
                    placeholder="Enter the answer..."
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Category
                  </label>
                  <select
                    value={newFAQ.category}
                    onChange={(e) =>
                      setNewFAQ({ ...newFAQ, category: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="General">General</option>
                    <option value="Pricing">Pricing</option>
                    <option value="Support">Support</option>
                    <option value="Products">Products</option>
                    <option value="Shipping">Shipping</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => setShowAddFAQ(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddFAQ}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    Add FAQ
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Data Management */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
      >
        <div className="flex items-center mb-6">
          <Trash2 className="w-6 h-6 text-red-600 mr-3" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Data Management
            </h2>
            <p className="text-slate-600">
              Manage your data and privacy settings
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
            <div>
              <p className="font-medium text-red-900">Clear all data</p>
              <p className="text-sm text-red-700">
                Permanently delete all contacts, campaigns, and templates
              </p>
            </div>
            <Button
              variant="outline"
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Clear Data
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <p className="font-medium text-slate-900">Export data</p>
              <p className="text-sm text-slate-600">
                Download all your data in JSON format
              </p>
            </div>
            <Button variant="outline">Export</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
