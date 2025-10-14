"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/lib/user-context";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import {
  Send,
  Calendar,
  Users,
  FileText,
  Bot,
  Play,
  Clock,
  MessageSquare,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
// Dynamically import react-datepicker on the client to avoid bundling it in the
// initial navigation bundle. CSS is imported client-side in an effect below.
const DatePicker = dynamic(() => import("react-datepicker"), { ssr: false });
import { generateMessageTone } from "@/lib/ai";
import { useTemplates } from "@/lib/templates";
import { BACKEND_URL } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  title: string;
  phone: string;
  tags?: string[];
}

interface Campaign {
  id: string;
  name: string;
  message: string;
  selectedContacts: string[];
  scheduleDate: Date | null;
  status: "draft" | "scheduled" | "sent";
  createdAt: Date;
  autoreplyEnabled?: boolean;
}

export default function CampaignsPage() {
  const { user } = useUser();
  const { templates } = useTemplates();

  // Redirect if not authenticated
  if (!user) {
    return null;
  }
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [message, setMessage] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [autoreplyEnabled, setAutoreplyEnabled] = useState(false);

  // Load react-datepicker CSS on the client only (since DatePicker is client-only)
  useEffect(() => {
    import("react-datepicker/dist/react-datepicker.css");
  }, []);
  const [sentReminders, setSentReminders] = useState<Set<string>>(new Set());
  const [showRecipientModal, setShowRecipientModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // Fetch contacts and campaigns on component mount
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const response = await fetch("/api/contacts");
        if (response.ok) {
          const data = await response.json();
          setContacts(data);
        }
      } catch (error) {
        console.error("Failed to fetch contacts:", error);
      }
    };

    const fetchCampaigns = async () => {
      try {
        const response = await fetch("/api/campaigns");
        if (response.ok) {
          const data = await response.json();
          setCampaigns(
            data.map((c: any) => ({
              ...c,
              scheduleDate: c.scheduleDate ? new Date(c.scheduleDate) : null,
              createdAt: new Date(c.createdAt),
            }))
          );
        }
      } catch (error) {
        console.error("Failed to fetch campaigns:", error);
      }
    };

    fetchContacts();
    fetchCampaigns();
  }, []);

  // Check for scheduled campaigns and send reminders
  useEffect(() => {
    const checkScheduledCampaigns = async () => {
      const now = new Date();
      const scheduledCampaigns = campaigns.filter(
        (c) => c.status === "scheduled" && c.scheduleDate
      );

      for (const campaign of scheduledCampaigns) {
        const timeUntilSend = campaign.scheduleDate!.getTime() - now.getTime();
        const campaignKey = `${campaign.id}`;

        // Check if campaign should be sent now
        if (timeUntilSend <= 0) {
          try {
            // Map saved contact IDs to full contact objects before sending
            const recipients = campaign.selectedContacts
              .map((id) => contacts.find((c) => c.id === id))
              .filter(Boolean);

            const response = await fetch(`${BACKEND_URL}/send-messages`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                selectedContacts: recipients,
                message: campaign.message,
                campaignName: campaign.name,
              }),
            });

            if (response.ok) {
              // Update campaign status to sent
              const updatedCampaigns = campaigns.map((c) =>
                c.id === campaign.id ? { ...c, status: "sent" as const } : c
              );
              setCampaigns(updatedCampaigns);
              localStorage.setItem(
                "campaigns",
                JSON.stringify(updatedCampaigns)
              );
              console.log(
                `Scheduled campaign "${campaign.name}" sent successfully`
              );
            }
          } catch (error) {
            console.error(
              `Failed to send scheduled campaign "${campaign.name}":`,
              error
            );
          }
        }
        // Send reminders if user has phone number and reminders are enabled
        else if (user?.phone && user.sessionActive) {
          const reminderTimes = [
            { hours: 24, label: "24 hours" },
            { hours: 6, label: "6 hours" },
            { minutes: 10, label: "10 minutes" },
            { minutes: 5, label: "5 minutes" },
          ];

          for (const reminder of reminderTimes) {
            const reminderTime = reminder.hours
              ? campaign.scheduleDate!.getTime() -
                reminder.hours * 60 * 60 * 1000
              : campaign.scheduleDate!.getTime() -
                reminder.minutes! * 60 * 1000;

            const reminderKey = `${campaignKey}-${reminder.label}`;

            if (
              Math.abs(now.getTime() - reminderTime) < 60000 &&
              !sentReminders.has(reminderKey)
            ) {
              try {
                const reminderMessage = `⏰ Campaign Reminder: Your campaign "${
                  campaign.name
                }" is scheduled to send in ${
                  reminder.label
                }.\n\n📅 Scheduled for: ${campaign.scheduleDate!.toLocaleString()}\n👥 Recipients: ${
                  campaign.selectedContacts.length
                }\n💬 Message: ${campaign.message.substring(0, 100)}${
                  campaign.message.length > 100 ? "..." : ""
                }`;

                const response = await fetch(`${BACKEND_URL}/send-reminder`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    phone: user.phone,
                    message: reminderMessage,
                  }),
                });

                if (response.ok) {
                  setSentReminders((prev) => new Set([...prev, reminderKey]));
                  console.log(
                    `Reminder sent for campaign "${campaign.name}" (${reminder.label})`
                  );
                }
              } catch (error) {
                console.error(
                  `Failed to send reminder for campaign "${campaign.name}":`,
                  error
                );
              }
            }
          }
        }
      }
    };

    // Check immediately and then every minute
    checkScheduledCampaigns();
    const interval = setInterval(checkScheduledCampaigns, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [campaigns, user, sentReminders]);

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setMessage(template.content);
    }
  };

  const handleGenerateAI = async () => {
    if (!message.trim()) {
      alert("Please enter a base message first");
      return;
    }

    setIsGenerating(true);

    const result = await generateMessageTone(
      message,
      "friendly but professional"
    );
    if (result.success && result.data) {
      setMessage(result.data);
    } else {
      alert("AI generation failed: " + (result.error || "Unknown error"));
    }
    setIsGenerating(false);
  };

  const saveCampaign = async (status: "draft" | "scheduled" | "sent") => {
    const campaign: Campaign = {
      id: Date.now().toString(),
      name: campaignName,
      message,
      selectedContacts,
      scheduleDate,
      status,
      createdAt: new Date(),
      autoreplyEnabled,
    };

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(campaign),
      });

      if (response.ok) {
        const newCampaign = await response.json();
        setCampaigns((prev) => [
          ...prev,
          {
            ...newCampaign,
            scheduleDate: newCampaign.scheduleDate
              ? new Date(newCampaign.scheduleDate)
              : null,
            createdAt: new Date(newCampaign.createdAt),
          },
        ]);
      } else {
        alert("Failed to save campaign");
        return;
      }
    } catch (error) {
      console.error("Error saving campaign:", error);
      alert("Error saving campaign");
      return;
    }

    // Reset form
    setCampaignName("");
    setSelectedTemplate("");
    setMessage("");
    setSelectedContacts([]);
    setScheduleDate(null);
    setAttachments([]);
    setAutoreplyEnabled(false);
  };

  const handleSendNow = async () => {
    if (!campaignName || !message || selectedContacts.length === 0 || isSending)
      return;

    setIsSending(true);

    try {
      // Map selected contact IDs to full contact objects before sending
      const recipients = selectedContacts
        .map((id) => contacts.find((c) => c.id === id))
        .filter(Boolean);

      const response = await fetch(`${BACKEND_URL}/send-messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedContacts: recipients,
          message,
          campaignName,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        if (result.duplicate) {
          alert(
            `Campaign "${campaignName}" was already sent previously.\nThis prevents duplicate messages.`
          );
          return;
        }

        saveCampaign("sent");
        alert(
          `Campaign "${campaignName}" sent successfully!\nSuccess: ${result.success}\nFailed: ${result.failed}`
        );
      } else {
        alert("Failed to send campaign");
      }
    } catch (error) {
      console.error("Error sending campaign:", error);
      alert("Error sending campaign");
    } finally {
      setIsSending(false);
    }
  };

  const handleSchedule = () => {
    if (!scheduleDate) return;

    saveCampaign("scheduled");
    alert(
      `Campaign "${campaignName}" scheduled for ${scheduleDate.toLocaleString()}`
    );
  };

  const previewMessage = (contact: Contact) => {
    return message
      .replace(/{{name}}/g, contact.name)
      .replace(/{{title}}/g, contact.title || "");
  };

  const deleteCampaign = async (campaignId: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;

    try {
      const response = await fetch(`/api/campaigns?id=${campaignId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
      } else {
        alert("Failed to delete campaign");
      }
    } catch (error) {
      console.error("Error deleting campaign:", error);
      alert("Error deleting campaign");
    }
  };

  const resetSentCampaigns = async () => {
    if (
      !confirm(
        "This will allow previously sent campaigns to be sent again. Continue?"
      )
    )
      return;

    try {
      const response = await fetch(`${BACKEND_URL}/reset-sent-campaigns`, {
        method: "POST",
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(
          "Sent campaigns history has been reset. You can now resend campaigns."
        );
      } else {
        alert(
          `Failed to reset sent campaigns history: ${
            result.error || "Unknown error"
          }`
        );
      }
    } catch (error) {
      console.error("Error resetting sent campaigns:", error);
      alert(
        "Error resetting sent campaigns history: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Create Campaign</h1>
        <p className="text-slate-600 mt-2">
          Compose and schedule your WhatsApp messaging campaigns.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Campaign Composer */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          {/* Campaign Details */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Campaign Details
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Campaign Name"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">
                    Enable AI Autoreply
                  </p>
                  <p className="text-sm text-slate-600">
                    Automatically respond to incoming messages with AI-generated
                    replies
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoreplyEnabled}
                    onChange={(e) => setAutoreplyEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Message Composer */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Message</h2>
              <Button
                onClick={handleGenerateAI}
                disabled={isGenerating}
                variant="outline"
                size="sm"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Bot className="w-4 h-4 mr-2" />
                )}
                {isGenerating ? "Generating..." : "AI Generate"}
              </Button>
            </div>

            <div className="space-y-4">
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a template (optional)</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>

              <textarea
                placeholder="Compose your message... Use {{name}} and {{title}} for personalization"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />

              <div className="text-sm text-slate-500">
                Characters: {message.length} | Personalization: name, title
              </div>
            </div>
          </div>

          {/* Contact Selection */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Select Recipients
            </h2>
            <Button
              onClick={() => setShowRecipientModal(true)}
              variant="outline"
              className="w-full justify-start"
            >
              <Users className="w-4 h-4 mr-2" />
              {selectedContacts.length > 0
                ? `${selectedContacts.length} contact${
                    selectedContacts.length > 1 ? "s" : ""
                  } selected`
                : "Select Recipients"}
            </Button>
          </div>

          {/* Scheduling */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Schedule
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Send Date & Time
                </label>
                <DatePicker
                  selected={scheduleDate}
                  onChange={(date) => setScheduleDate(date)}
                  showTimeSelect
                  dateFormat="Pp"
                  placeholderText="Select date and time"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              onClick={handleSendNow}
              disabled={
                !campaignName ||
                !message ||
                selectedContacts.length === 0 ||
                isSending
              }
              className="bg-green-600 hover:bg-green-700 flex-1"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Now
                </>
              )}
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={
                !campaignName ||
                !message ||
                selectedContacts.length === 0 ||
                !scheduleDate
              }
              variant="outline"
              className="flex-1"
            >
              <Clock className="w-4 h-4 mr-2" />
              Schedule
            </Button>
          </div>
        </motion.div>

        {/* Preview Panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Message Preview
            </h2>
            <div className="space-y-4">
              {selectedContacts.length > 0 ? (
                selectedContacts.slice(0, 3).map((contactId) => {
                  const contact = contacts.find((c) => c.id === contactId);
                  return contact ? (
                    <div
                      key={contact.id}
                      className="bg-slate-50 rounded-lg p-4"
                    >
                      <div className="font-medium text-slate-900 mb-2">
                        To: {contact.name}
                      </div>
                      <div className="text-slate-700 text-sm">
                        {previewMessage(contact)}
                      </div>
                    </div>
                  ) : null;
                })
              ) : (
                <div className="text-center text-slate-500 py-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select contacts to see message preview</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Campaign Summary
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-600">Recipients:</span>
                <span className="font-medium">{selectedContacts.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Message Length:</span>
                <span className="font-medium">{message.length} chars</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Scheduled:</span>
                <span className="font-medium">
                  {scheduleDate ? scheduleDate.toLocaleString() : "Send now"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">AI Autoreply:</span>
                <span
                  className={`font-medium ${
                    autoreplyEnabled ? "text-green-600" : "text-slate-500"
                  }`}
                >
                  {autoreplyEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Campaign History */}
      {campaigns.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8"
        >
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900">
                Campaign History
              </h2>
              <Button
                onClick={resetSentCampaigns}
                variant="outline"
                size="sm"
                className="text-orange-600 border-orange-300 hover:bg-orange-50"
              >
                Reset Sent History
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns
                .slice()
                .reverse()
                .map((campaign) => (
                  <div
                    key={campaign.id}
                    className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-medium text-slate-900 text-sm leading-tight">
                        {campaign.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            campaign.status === "sent"
                              ? "bg-green-100 text-green-800"
                              : campaign.status === "scheduled"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {campaign.status}
                        </span>
                        <button
                          onClick={() => deleteCampaign(campaign.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Delete campaign"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-slate-600">
                        {campaign.selectedContacts.length} recipients •{" "}
                        {campaign.message.length} chars
                      </p>
                      <p className="text-xs text-slate-500">
                        Created: {campaign.createdAt.toLocaleString()}
                      </p>
                      {campaign.scheduleDate && (
                        <p className="text-xs text-slate-500">
                          Scheduled: {campaign.scheduleDate.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Recipient Selection Modal */}
      {showRecipientModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Select Recipients
              </h3>
              <button
                onClick={() => setShowRecipientModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={
                    selectedContacts.length === contacts.length &&
                    contacts.length > 0
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedContacts(contacts.map((c) => c.id));
                    } else {
                      setSelectedContacts([]);
                    }
                  }}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">
                  Select All
                </span>
              </div>
              <span className="text-sm text-slate-600">
                {selectedContacts.length} of {contacts.length} selected
              </span>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg">
              <div className="divide-y divide-slate-200">
                {contacts.map((contact) => (
                  <label
                    key={contact.id}
                    className="flex items-center space-x-3 p-4 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedContacts.includes(contact.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedContacts([
                            ...selectedContacts,
                            contact.id,
                          ]);
                        } else {
                          setSelectedContacts(
                            selectedContacts.filter((id) => id !== contact.id)
                          );
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">
                        {contact.name}
                      </div>
                      <div className="text-sm text-slate-500">
                        {contact.title || "No title"} • {contact.phone}
                      </div>
                      {contact.tags && contact.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {contact.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setShowRecipientModal(false)}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
