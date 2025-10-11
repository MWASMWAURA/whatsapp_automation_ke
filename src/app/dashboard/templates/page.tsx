"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Plus, Edit, Trash2, Eye, Bot } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTemplates, Template } from "@/lib/templates";

export default function TemplatesPage() {
  const { templates, addTemplate, updateTemplate, deleteTemplate } =
    useTemplates();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );
  const [isCreating, setIsCreating] = useState(false);
  const [previewContact, setPreviewContact] = useState({
    name: "John Doe",
    title: "CEO",
  });

  const handleCreateTemplate = () => {
    setIsCreating(true);
    setSelectedTemplate({
      id: "",
      name: "",
      content: "",
      category: "",
      createdAt: new Date().toISOString().split("T")[0],
    });
  };

  const handleSaveTemplate = () => {
    if (selectedTemplate) {
      if (selectedTemplate.id) {
        // Update existing
        updateTemplate(selectedTemplate.id, selectedTemplate);
      } else {
        // Create new
        addTemplate(selectedTemplate);
      }
      setSelectedTemplate(null);
      setIsCreating(false);
    }
  };

  const handleDeleteTemplate = (id: string) => {
    deleteTemplate(id);
  };

  const renderPreview = (content: string) => {
    return content
      .replace(/{{name}}/g, previewContact.name)
      .replace(/{{title}}/g, previewContact.title);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Message Templates
          </h1>
          <p className="text-slate-600 mt-2">
            Create and manage reusable message templates with personalization.
          </p>
        </div>
        <Button
          onClick={handleCreateTemplate}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Template Preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
      >
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Live Preview
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Preview Contact
            </label>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Name"
                value={previewContact.name}
                onChange={(e) =>
                  setPreviewContact({ ...previewContact, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Title"
                value={previewContact.title}
                onChange={(e) =>
                  setPreviewContact({
                    ...previewContact,
                    title: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Message Preview
            </label>
            <div className="bg-slate-50 rounded-lg p-4 min-h-[100px]">
              {selectedTemplate ? (
                <p className="text-slate-700">
                  {renderPreview(selectedTemplate.content)}
                </p>
              ) : (
                <p className="text-slate-500 italic">
                  Select a template to preview
                </p>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Template Editor */}
      {(selectedTemplate || isCreating) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
        >
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {selectedTemplate?.id ? "Edit Template" : "Create Template"}
          </h2>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Template Name"
                value={selectedTemplate?.name || ""}
                onChange={(e) =>
                  setSelectedTemplate({
                    ...selectedTemplate!,
                    name: e.target.value,
                  })
                }
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={selectedTemplate?.category || ""}
                onChange={(e) =>
                  setSelectedTemplate({
                    ...selectedTemplate!,
                    category: e.target.value,
                  })
                }
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Category</option>
                <option value="Sales">Sales</option>
                <option value="Marketing">Marketing</option>
                <option value="Support">Support</option>
                <option value="Onboarding">Onboarding</option>
                <option value="General">General</option>
              </select>
            </div>
            <textarea
              placeholder="Message content with {{name}} and {{title}} placeholders"
              value={selectedTemplate?.content || ""}
              onChange={(e) =>
                setSelectedTemplate({
                  ...selectedTemplate!,
                  content: e.target.value,
                })
              }
              rows={6}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSaveTemplate}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Save Template
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedTemplate(null);
                  setIsCreating(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Templates Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template, index) => (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <FileText className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="font-semibold text-slate-900">
                  {template.name}
                </h3>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                {template.category}
              </span>
            </div>
            <p className="text-slate-600 text-sm mb-4 line-clamp-3">
              {template.content}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Created {template.createdAt}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setSelectedTemplate(template)}
                  className="p-1 text-slate-600 hover:text-slate-900"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedTemplate(template)}
                  className="p-1 text-slate-600 hover:text-slate-900"
                  title="Preview"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteTemplate(template.id)}
                  className="p-1 text-red-600 hover:text-red-900"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
