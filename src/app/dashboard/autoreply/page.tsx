"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Bot, Send, User } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Campaign {
  id: string;
  name: string;
  autoreplyEnabled?: boolean;
}

interface Reply {
  id: string;
  campaignId: string;
  contactId: string;
  message: string;
  sentiment: "positive" | "negative" | "neutral";
  timestamp: string;
  isAIResponded?: boolean;
  aiResponse?: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
}

export default function AutoreplyPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedReply, setSelectedReply] = useState<Reply | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const response = await fetch("/api/campaigns");
        if (response.ok) {
          const data = await response.json();
          setCampaigns(data);
          if (data.length > 0 && selectedCampaigns.length === 0) {
            setSelectedCampaigns(data.map((c) => c.id));
          }
        }
      } catch (error) {
        console.error("Failed to fetch campaigns:", error);
      }
    };

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

    fetchCampaigns();
    fetchContacts();
  }, []);

  useEffect(() => {
    const fetchReplies = async () => {
      if (selectedCampaigns.length === 0) return;

      try {
        const response = await fetch(
          `/api/replies?campaignIds=${selectedCampaigns.join(",")}`
        );
        if (response.ok) {
          const data = await response.json();
          setReplies(data);
        }
      } catch (error) {
        console.error("Failed to fetch replies:", error);
      }
    };

    fetchReplies();
  }, [selectedCampaigns]);

  const handleReplySelect = (reply: Reply) => {
    setSelectedReply(reply);
    const contact = contacts.find((c) => c.id === reply.contactId);
    setChatMessages([
      {
        id: "1",
        type: "user",
        content: reply.message,
        timestamp: reply.timestamp,
        sender: contact?.name || "Unknown",
      },
      ...(reply.aiResponse
        ? [
            {
              id: "2",
              type: "ai",
              content: reply.aiResponse,
              timestamp: new Date().toISOString(),
              sender: "AI Assistant",
            },
          ]
        : []),
    ]);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedReply) return;

    const messageToSend = newMessage.trim();
    const userMessage = {
      id: Date.now().toString(),
      type: "user",
      content: messageToSend,
      timestamp: new Date().toISOString(),
      sender: "You",
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setNewMessage("");

    try {
      // Get contact phone number
      const contact = contacts.find((c) => c.id === selectedReply.contactId);
      if (!contact) {
        const errorMessage = {
          id: (Date.now() + 1).toString(),
          type: "system",
          content: "Error: Could not find contact phone number",
          timestamp: new Date().toISOString(),
          sender: "System",
        };
        setChatMessages((prev) => [...prev, errorMessage]);
        return;
      }

      // Send message via backend
      const response = await fetch("/api/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: contact.phone,
          message: messageToSend,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        // Add success message to chat
        const successMessage = {
          id: (Date.now() + 2).toString(),
          type: "system",
          content: "✅ Message sent successfully",
          timestamp: new Date().toISOString(),
          sender: "System",
        };
        setChatMessages((prev) => [...prev, successMessage]);

        // Update the reply record to mark as human responded
        await fetch(`/api/replies`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: selectedReply.id,
            isHumanResponded: true,
            humanResponse: messageToSend,
            humanResponseTime: new Date().toISOString(),
          }),
        });

        // Refresh replies to update the UI
        const repliesResponse = await fetch(
          `/api/replies?campaignIds=${selectedCampaigns.join(",")}`
        );
        if (repliesResponse.ok) {
          const updatedReplies = await repliesResponse.json();
          setReplies(updatedReplies);
        }
      } else {
        const error = await response.json();
        const errorMessage = {
          id: (Date.now() + 2).toString(),
          type: "system",
          content: `❌ Failed to send message: ${
            error.error || "Unknown error"
          }`,
          timestamp: new Date().toISOString(),
          sender: "System",
        };
        setChatMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage = {
        id: (Date.now() + 2).toString(),
        type: "system",
        content: "❌ Failed to send message due to network error",
        timestamp: new Date().toISOString(),
        sender: "System",
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    }
  };

  const aiRespondedReplies = replies.filter((reply) => reply.isAIResponded);
  const allReplies = replies;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">AI Autoreply</h1>
        <p className="text-slate-600 mt-2">
          Monitor and interact with AI-generated responses to customer messages.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Conversations List */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Campaigns
              </h2>
              <select
                multiple
                value={selectedCampaigns}
                onChange={(e) => {
                  const values = Array.from(
                    e.target.selectedOptions,
                    (option) => option.value
                  );
                  setSelectedCampaigns(values);
                }}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              >
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              All Incoming Replies ({allReplies.length})
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {allReplies.length > 0 ? (
                allReplies.map((reply) => {
                  const contact = contacts.find(
                    (c) => c.id === reply.contactId
                  );
                  return (
                    <div
                      key={reply.id}
                      onClick={() => handleReplySelect(reply)}
                      className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${
                        selectedReply?.id === reply.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-900">
                          {contact?.name || "Unknown Contact"}
                        </span>
                        <div className="flex items-center gap-2">
                          {reply.isAIResponded && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              AI Responded
                            </span>
                          )}
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              reply.sentiment === "positive"
                                ? "bg-green-100 text-green-800"
                                : reply.sentiment === "negative"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {reply.sentiment}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 truncate">
                        {reply.message}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(reply.timestamp).toLocaleString()}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-slate-500 py-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No incoming replies yet</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              AI-Responded Conversations ({aiRespondedReplies.length})
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {aiRespondedReplies.length > 0 ? (
                aiRespondedReplies.map((reply) => {
                  const contact = contacts.find(
                    (c) => c.id === reply.contactId
                  );
                  return (
                    <div
                      key={reply.id}
                      onClick={() => handleReplySelect(reply)}
                      className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${
                        selectedReply?.id === reply.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-900">
                          {contact?.name || "Unknown Contact"}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            reply.sentiment === "positive"
                              ? "bg-green-100 text-green-800"
                              : reply.sentiment === "negative"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {reply.sentiment}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 truncate">
                        {reply.message}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(reply.timestamp).toLocaleString()}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-slate-500 py-8">
                  <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No AI-responded conversations yet</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Chat Interface */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[600px]"
        >
          {selectedReply ? (
            <>
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Chat with{" "}
                      {contacts.find((c) => c.id === selectedReply.contactId)
                        ?.name || "Contact"}
                    </h2>
                    <p className="text-sm text-slate-600">
                      AI Autoreply Active
                    </p>
                  </div>
                  <div
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedReply.sentiment === "positive"
                        ? "bg-green-100 text-green-800"
                        : selectedReply.sentiment === "negative"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {selectedReply.sentiment} sentiment
                  </div>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.type === "user" ? "justify-end" : "justify-center"
                    }`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.type === "user"
                          ? "bg-blue-600 text-white"
                          : message.type === "system"
                          ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                          : "bg-slate-100 text-slate-900"
                      }`}
                    >
                      <div className="flex items-center mb-1">
                        {message.type === "user" ? (
                          <User className="w-4 h-4 mr-2" />
                        ) : message.type === "system" ? (
                          <MessageSquare className="w-4 h-4 mr-2" />
                        ) : (
                          <Bot className="w-4 h-4 mr-2" />
                        )}
                        <span className="text-xs font-medium">
                          {message.sender}
                        </span>
                      </div>
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-slate-200">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Type your message..."
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-slate-500">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">
                  Select a conversation
                </h3>
                <p>Choose a conversation from the list to start chatting</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
