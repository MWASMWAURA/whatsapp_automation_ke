"use client";

import { motion } from "framer-motion";
import { Users, HeadphonesIcon, TrendingUp, MessageCircle } from "lucide-react";

const useCases = [
  {
    icon: Users,
    title: "Marketing Campaigns",
    description:
      "Send personalized promotional messages to your customer base with automated follow-ups.",
  },
  {
    icon: HeadphonesIcon,
    title: "Customer Support",
    description:
      "Provide instant responses and support through WhatsApp with AI-powered chatbots.",
  },
  {
    icon: TrendingUp,
    title: "Sales Follow-ups",
    description:
      "Nurture leads and close deals with timely, personalized sales messages.",
  },
];

export default function UseCases() {
  return (
    <section className="py-20 bg-slate-50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Perfect for Every Business Need
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            From marketing to support, AutoSend Pro adapts to your workflow.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {useCases.map((useCase, index) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-shadow"
            >
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <useCase.icon className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 mb-4">
                {useCase.title}
              </h3>
              <p className="text-slate-600">{useCase.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
