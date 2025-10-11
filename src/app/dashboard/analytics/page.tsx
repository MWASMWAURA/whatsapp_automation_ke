"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Users,
  MessageSquare,
  Calendar,
  Filter,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Bar,
} from "recharts";
import dynamic from "next/dynamic";

// Load the heavy recharts bundle only on the client when the charts are visible
const ChartsClient = dynamic(() => import("./ChartsClient"), { ssr: false });

const deliveryData = [
  { name: "Sent", value: 2847, color: "#3b82f6" },
  { name: "Delivered", value: 2650, color: "#10b981" },
  { name: "Read", value: 2100, color: "#f59e0b" },
  { name: "Failed", value: 197, color: "#ef4444" },
];

const timeSeriesData = [
  { date: "2024-01-01", sent: 120, delivered: 110, read: 85 },
  { date: "2024-01-02", sent: 150, delivered: 140, read: 110 },
  { date: "2024-01-03", sent: 180, delivered: 170, read: 135 },
  { date: "2024-01-04", sent: 200, delivered: 185, read: 150 },
  { date: "2024-01-05", sent: 220, delivered: 200, read: 165 },
  { date: "2024-01-06", sent: 190, delivered: 180, read: 145 },
  { date: "2024-01-07", sent: 210, delivered: 195, read: 160 },
];

const campaignData = [
  { name: "Welcome Campaign", sent: 500, delivered: 480, read: 350 },
  { name: "Product Launch", sent: 800, delivered: 760, read: 520 },
  { name: "Follow-up", sent: 300, delivered: 290, read: 200 },
  { name: "Newsletter", sent: 600, delivered: 570, read: 380 },
];

const tagData = [
  { name: "VIP", value: 25, color: "#8b5cf6" },
  { name: "Regular", value: 45, color: "#06b6d4" },
  { name: "New", value: 20, color: "#84cc16" },
  { name: "Inactive", value: 10, color: "#f97316" },
];

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("7d");
  const [selectedCampaign, setSelectedCampaign] = useState("all");

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-600 mt-2">
            Track your campaign performance and engagement metrics.
          </p>
        </div>
        <div className="flex gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Campaigns</option>
            <option value="welcome">Welcome Campaign</option>
            <option value="product">Product Launch</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {deliveryData.map((metric, index) => (
          <motion.div
            key={metric.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">
                  {metric.name}
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-1">
                  {metric.value.toLocaleString()}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {((metric.value / deliveryData[0].value) * 100).toFixed(1)}%
                  of sent
                </p>
              </div>
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${metric.color}20` }}
              >
                <div
                  className="w-6 h-6 rounded"
                  style={{ backgroundColor: metric.color }}
                ></div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Time Series Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
        >
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Message Activity Over Time
          </h3>
          <ChartsClient
            timeSeriesData={timeSeriesData}
            deliveryData={deliveryData}
            campaignData={campaignData}
            tagData={tagData}
          />
        </motion.div>

        {/* Delivery Status Pie Chart */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
        >
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Delivery Status
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={deliveryData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {deliveryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center flex-wrap gap-4 mt-4">
            {deliveryData.map((item) => (
              <div key={item.name} className="flex items-center">
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: item.color }}
                ></div>
                <span className="text-sm text-slate-600">
                  {item.name}: {item.value}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Campaign Performance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
      >
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Campaign Performance
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={campaignData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="sent" fill="#3b82f6" name="Sent" />
            <Bar dataKey="delivered" fill="#10b981" name="Delivered" />
            <Bar dataKey="read" fill="#f59e0b" name="Read" />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Contact Tags Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
      >
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Contact Tags Distribution
        </h3>
        <div className="grid md:grid-cols-2 gap-8">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={tagData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${((percent as number) * 100).toFixed(0)}%`
                }
              >
                {tagData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-3">
            {tagData.map((tag) => (
              <div key={tag.name} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div
                    className="w-4 h-4 rounded mr-3"
                    style={{ backgroundColor: tag.color }}
                  ></div>
                  <span className="font-medium text-slate-900">{tag.name}</span>
                </div>
                <span className="text-slate-600">{tag.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
