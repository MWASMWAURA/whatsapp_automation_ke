"use client";

import { motion } from "framer-motion";
import { Upload, MessageSquare, BarChart3, Bot } from "lucide-react";

const features = [
  {
    icon: Upload,
    title: "Upload Contacts",
    description:
      "Easily import contacts from CSV files or add them manually with our intuitive interface.",
  },
  {
    icon: MessageSquare,
    title: "Personalize Messages",
    description:
      "Use dynamic placeholders like {{name}} and {{title}} to create personalized messages at scale.",
  },
  {
    icon: Bot,
    title: "AI Name Cleanup",
    description:
      "Leverage AI to standardize and correct contact names and titles automatically.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description:
      "Track delivery rates, engagement metrics, and campaign performance in real-time.",
  },
];

export default function Features() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Powerful Features for WhatsApp Marketing
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Everything you need to run successful WhatsApp campaigns with
            AI-powered automation.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-slate-50 rounded-xl p-6 hover:shadow-lg transition-shadow"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-600">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
