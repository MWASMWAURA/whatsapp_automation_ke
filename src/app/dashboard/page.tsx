"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MessageSquare,
  TrendingUp,
  Activity,
  Users,
  ThumbsUp,
  ThumbsDown,
  Minus,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Campaign {
  id: string;
  name: string;
  contacts: string[];
  replyStats?: {
    totalReplies: number;
    positive: number;
    negative: number;
    neutral: number;
  };
}

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [replies, setReplies] = useState<any[]>([]);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const response = await fetch("/api/campaigns");
        if (response.ok) {
          const data = await response.json();
          setCampaigns(data);
          if (data.length > 0 && !selectedCampaign) {
            setSelectedCampaign(data[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch campaigns:", error);
      }
    };

    fetchCampaigns();
  }, []);

  useEffect(() => {
    const fetchReplies = async () => {
      if (!selectedCampaign) return;

      try {
        const response = await fetch(
          `/api/replies?campaignId=${selectedCampaign}`
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
  }, [selectedCampaign]);

  const selectedCampaignData = campaigns.find((c) => c.id === selectedCampaign);
  const totalContacts = selectedCampaignData?.contacts?.length || 0;
  const totalReplies = replies.length;
  const replyRate =
    totalContacts > 0 ? ((totalReplies / totalContacts) * 100).toFixed(1) : "0";

  const sentimentStats = replies.reduce(
    (acc, reply) => {
      acc[reply.sentiment] = (acc[reply.sentiment] || 0) + 1;
      return acc;
    },
    { positive: 0, negative: 0, neutral: 0 }
  );

  const stats = [
    {
      name: "Reply Rate",
      value: `${replyRate}%`,
      change: `${totalReplies}/${totalContacts} replies`,
      changeType: "neutral" as const,
      icon: MessageSquare,
    },
    {
      name: "Positive Replies",
      value: sentimentStats.positive.toString(),
      change: `${
        totalReplies > 0
          ? ((sentimentStats.positive / totalReplies) * 100).toFixed(1)
          : 0
      }% of total`,
      changeType: "positive" as const,
      icon: ThumbsUp,
    },
    {
      name: "Negative Replies",
      value: sentimentStats.negative.toString(),
      change: `${
        totalReplies > 0
          ? ((sentimentStats.negative / totalReplies) * 100).toFixed(1)
          : 0
      }% of total`,
      changeType: "negative" as const,
      icon: ThumbsDown,
    },
    {
      name: "Neutral Replies",
      value: sentimentStats.neutral.toString(),
      change: `${
        totalReplies > 0
          ? ((sentimentStats.neutral / totalReplies) * 100).toFixed(1)
          : 0
      }% of total`,
      changeType: "neutral" as const,
      icon: Minus,
    },
  ];

  const chartData = [
    { name: "Mon", sent: 1200, delivered: 1100 },
    { name: "Tue", sent: 1400, delivered: 1300 },
    { name: "Wed", sent: 1600, delivered: 1500 },
    { name: "Thu", sent: 1800, delivered: 1700 },
    { name: "Fri", sent: 2000, delivered: 1850 },
    { name: "Sat", sent: 1500, delivered: 1400 },
    { name: "Sun", sent: 1300, delivered: 1200 },
  ];

  const pieData = [
    { name: "Positive", value: sentimentStats.positive, color: "#10b981" },
    { name: "Negative", value: sentimentStats.negative, color: "#ef4444" },
    { name: "Neutral", value: sentimentStats.neutral, color: "#6b7280" },
  ];
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-2">
          Welcome back! Here's what's happening with your campaigns.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: index * 0.1 }}
            className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">
                  {stat.name}
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {stat.value}
                </p>
                <p
                  className={`text-sm mt-1 ${
                    stat.changeType === "positive"
                      ? "text-green-600"
                      : stat.changeType === "negative"
                      ? "text-red-600"
                      : "text-slate-500"
                  }`}
                >
                  {stat.change} from last week
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <stat.icon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
        >
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Message Activity
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="sent"
                stroke="#3b82f6"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="delivered"
                stroke="#10b981"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
        >
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Reply Sentiment Analysis
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center space-x-6 mt-4">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center">
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: item.color }}
                ></div>
                <span className="text-sm text-slate-600">
                  {item.name}: {item.value}%
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Create Campaign Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-8 text-white text-center"
      >
        <h3 className="text-2xl font-bold mb-2">
          Ready to launch your next campaign?
        </h3>
        <p className="mb-6 opacity-90">
          Create personalized messages and reach your audience at scale.
        </p>
        <button className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-slate-50 transition-colors">
          Create Campaign
        </button>
      </motion.div>
    </div>
  );
}
