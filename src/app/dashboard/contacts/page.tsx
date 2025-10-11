"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  Users,
  Search,
  Edit,
  Trash2,
  Bot,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useDropzone } from "react-dropzone";
import {
  standardizeContactName,
  cleanPhoneNumber,
  processCSVData,
  CSVProcessingResponse,
} from "@/lib/ai";
import Papa from "papaparse";

interface Contact {
  id: string;
  name: string;
  title: string;
  phone: string;
  tags: string[];
  aiSuggested?: string;
}

const mockContacts: Contact[] = [
  {
    id: "1",
    name: "John Doe",
    title: "CEO",
    phone: "+1234567890",
    tags: ["VIP", "Tech"],
  },
  {
    id: "2",
    name: "Jane Smith",
    title: "Marketing Manager",
    phone: "+1234567891",
    tags: ["Marketing"],
  },
  {
    id: "3",
    name: "Bob Johnson",
    title: "Sales Rep",
    phone: "+1234567892",
    tags: ["Sales"],
  },
];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  const [newContact, setNewContact] = useState({
    name: "",
    title: "",
    phone: "",
    tags: [] as string[],
  });
  const [uploadLoading, setUploadLoading] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [cleaningPhones, setCleaningPhones] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiProcessing, setAiProcessing] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: string | number;
  } | null>(null);

  // Fetch contacts on component mount
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

    fetchContacts();
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "text/csv": [".csv"],
    },
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;

      setUploadLoading(true);
      const file = acceptedFiles[0];

      Papa.parse(
        file as any,
        {
          header: true,
          skipEmptyLines: true,
          complete: (results: Papa.ParseResult<any>) => {
            const headers = results.meta.fields || [];
            setCsvHeaders(headers);
            setCsvPreview(results.data);
            setShowPreview(true);
            setUploadLoading(false);
          },
          error: (error: any) => {
            console.error("CSV parsing error:", error);
            alert("Failed to parse CSV file. Please check the format.");
            setUploadLoading(false);
          },
        } as any
      );
    },
  });

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAICleanup = async (contactId: string) => {
    setAiLoading(contactId);

    const contact = contacts.find((c) => c.id === contactId);
    if (contact) {
      try {
        const result = await standardizeContactName(contact.name);
        if (result.success && result.data) {
          setContacts(
            contacts.map((c) =>
              c.id === contactId ? { ...c, aiSuggested: result.data } : c
            )
          );
        } else {
          // Provide more user-friendly error messages
          let errorMessage = "AI cleanup failed";
          if (result.error?.includes("401")) {
            errorMessage =
              "AI service authentication failed. Please check your API key in settings.";
          } else if (result.error?.includes("429")) {
            errorMessage =
              "AI service rate limit exceeded. Please try again later.";
          } else if (result.error?.includes("500")) {
            errorMessage =
              "AI service is temporarily unavailable. Please try again later.";
          } else if (result.error) {
            errorMessage = `AI cleanup failed: ${result.error}`;
          }
          alert(errorMessage);
        }
      } catch (error) {
        console.error("AI cleanup error:", error);
        alert(
          "AI cleanup failed due to a network error. Please check your connection and try again."
        );
      }
    }
    setAiLoading(null);
  };

  const applyAISuggestion = (contactId: string) => {
    setContacts(
      contacts.map((c) =>
        c.id === contactId
          ? { ...c, name: c.aiSuggested || c.name, aiSuggested: undefined }
          : c
      )
    );
  };

  const handleAddContact = async () => {
    if (!newContact.name.trim() || !newContact.phone.trim()) {
      alert("Name and phone are required");
      return;
    }

    const contact: Contact = {
      id: Date.now().toString(),
      name: newContact.name.trim(),
      title: newContact.title.trim(),
      phone: newContact.phone.trim(),
      tags: newContact.tags,
    };

    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(contact),
      });

      if (response.ok) {
        setContacts([...contacts, contact]);
        setNewContact({ name: "", title: "", phone: "", tags: [] });
        setShowAddModal(false);
      } else {
        alert("Failed to add contact");
      }
    } catch (error) {
      console.error("Error adding contact:", error);
      alert("Error adding contact");
    }
  };

  const handleDeleteContact = (contactId: string) => {
    setContactToDelete(contactId);
    setShowDeleteModal(true);
  };

  const confirmDeleteContact = () => {
    if (contactToDelete) {
      setContacts(contacts.filter((c) => c.id !== contactToDelete));
      setShowDeleteModal(false);
      setContactToDelete(null);
    }
  };

  const handleAICleanPhones = async () => {
    setCleaningPhones(true);

    // Find phone column
    const phoneColumn = csvHeaders.find(
      (h) =>
        h.toLowerCase().includes("phone") || h.toLowerCase().includes("number")
    );

    if (!phoneColumn) {
      alert("No phone column found in CSV");
      setCleaningPhones(false);
      return;
    }

    const cleanedPreview = [...csvPreview];

    for (let i = 0; i < cleanedPreview.length; i++) {
      const phone = cleanedPreview[i][phoneColumn];
      if (phone && phone.trim()) {
        try {
          const result = await cleanPhoneNumber(phone);
          if (result.success && result.data) {
            cleanedPreview[i][phoneColumn] = result.data;
          }
        } catch (error) {
          console.error(`Failed to clean phone for row ${i}:`, error);
        }
      }
    }

    setCsvPreview(cleanedPreview);
    setCleaningPhones(false);
    alert("Phone numbers cleaned successfully!");
  };

  const handleImportContacts = async () => {
    const parsedContacts: Contact[] = [];
    const errors: string[] = [];

    csvPreview.forEach((row: any, index: number) => {
      const name = row.Name || row.name || "";
      const title = row.Title || row.title || "";
      const phone =
        row.Phone ||
        row.phone ||
        row["Phone Number"] ||
        row["phone number"] ||
        "";
      const tags = row.Tags || row.tags || "";

      if (!name.trim() || !phone.trim()) {
        errors.push(`Row ${index + 2}: Name and Phone are required`);
        return;
      }

      const contact: Contact = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: name.trim(),
        title: title.trim(),
        phone: phone.trim(),
        tags: tags
          ? tags
              .split(",")
              .map((tag: string) => tag.trim())
              .filter(Boolean)
          : [],
      };

      parsedContacts.push(contact);
    });

    if (errors.length > 0) {
      alert(`Import errors:\n${errors.join("\n")}`);
    } else if (parsedContacts.length > 0) {
      try {
        // Save all contacts to API
        const savePromises = parsedContacts.map((contact) =>
          fetch("/api/contacts", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(contact),
          })
        );

        const results = await Promise.all(savePromises);
        const failedCount = results.filter((r) => !r.ok).length;

        if (failedCount === 0) {
          setContacts((prev) => [...prev, ...parsedContacts]);
          alert(`Successfully imported ${parsedContacts.length} contacts`);
          setShowPreview(false);
          setCsvPreview([]);
          setCsvHeaders([]);
          setAiChatMessages([]);
        } else {
          alert(`Failed to save ${failedCount} contacts. Please try again.`);
        }
      } catch (error) {
        console.error("Error importing contacts:", error);
        alert("Error importing contacts");
      }
    } else {
      alert("No valid contacts found in the CSV file");
    }
  };

  const handleAISendMessage = async () => {
    if (!aiChatInput.trim()) return;

    const userMessage = aiChatInput.trim();
    setAiChatInput("");
    setAiProcessing(true);

    // Add user message to chat
    setAiChatMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
    ]);

    try {
      const result = await processCSVData(csvPreview, csvHeaders, userMessage);

      if (result.success && result.data) {
        // Add AI response to chat
        setAiChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `**Analysis:** ${
              result.data!.analysis
            }\n\n**Suggestions:**\n${result
              .data!.suggestions.map((s) => `• ${s}`)
              .join("\n")}`,
          },
        ]);

        // If AI provided transformed data, offer to apply it
        if (
          result.data!.transformedData &&
          result.data!.transformedData.length > 0
        ) {
          setAiChatMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Would you like me to apply these changes to your data?",
            },
          ]);
        }
      } else {
        setAiChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Sorry, I encountered an error: ${result.error}`,
          },
        ]);
      }
    } catch (error) {
      setAiChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, I encountered an error processing your request.`,
        },
      ]);
    }

    setAiProcessing(false);
  };

  const handleCellEdit = (rowIndex: number, column: string, value: string) => {
    const updatedPreview = [...csvPreview];
    updatedPreview[rowIndex][column] = value;
    setCsvPreview(updatedPreview);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Contacts</h1>
          <p className="text-slate-600 mt-2">
            Manage your contact lists and personalize your outreach.
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Users className="w-4 h-4 mr-2" />
          Add Contact
        </Button>
      </div>

      {/* Upload Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl p-8 shadow-sm border border-slate-200"
      >
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          Import Contacts
        </h2>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-blue-500 bg-blue-50"
              : uploadLoading
              ? "border-slate-300 bg-slate-50"
              : "border-slate-300 hover:border-slate-400"
          }`}
        >
          <input {...getInputProps()} />
          {uploadLoading ? (
            <Loader2 className="w-12 h-12 text-slate-400 mx-auto mb-4 animate-spin" />
          ) : (
            <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          )}
          <p className="text-slate-600">
            {uploadLoading
              ? "Processing CSV file..."
              : isDragActive
              ? "Drop the CSV file here..."
              : "Drag & drop a CSV file here, or click to select"}
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Supports CSV files with Name, Title, Phone columns
          </p>
        </div>
      </motion.div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <Button variant="outline">Filter by Tags</Button>
      </div>

      {/* Contacts Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedContacts(filteredContacts.map((c) => c.id));
                      } else {
                        setSelectedContacts([]);
                      }
                    }}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Tags
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
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
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {contact.name}
                      </div>
                      {contact.aiSuggested && (
                        <div className="text-xs text-blue-600 mt-1 flex items-center gap-2">
                          <Bot className="w-3 h-3" />
                          AI suggests: {contact.aiSuggested}
                          <button
                            onClick={() => applyAISuggestion(contact.id)}
                            className="text-green-600 hover:text-green-700"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {contact.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {contact.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAICleanup(contact.id)}
                        disabled={aiLoading === contact.id}
                        className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                        title="AI Name Cleanup"
                      >
                        {aiLoading === contact.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </button>
                      <button className="text-slate-600 hover:text-slate-900">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteContact(contact.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {selectedContacts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between"
        >
          <span className="text-sm text-blue-800">
            {selectedContacts.length} contact
            {selectedContacts.length > 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Add Tags
            </Button>
            <Button variant="outline" size="sm">
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700"
            >
              Delete Selected
            </Button>
          </div>
        </motion.div>
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Add New Contact
            </h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Full Name"
                value={newContact.name}
                onChange={(e) =>
                  setNewContact({ ...newContact, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Title/Position"
                value={newContact.title}
                onChange={(e) =>
                  setNewContact({ ...newContact, title: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="tel"
                placeholder="Phone Number (e.g., +1234567890)"
                value={newContact.phone}
                onChange={(e) =>
                  setNewContact({ ...newContact, phone: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Tags (comma-separated)"
                value={newContact.tags.join(", ")}
                onChange={(e) =>
                  setNewContact({
                    ...newContact,
                    tags: e.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter((tag) => tag),
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                onClick={handleAddContact}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Add Contact
              </Button>
              <Button
                onClick={() => setShowAddModal(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Contact Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Delete Contact
            </h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete this contact? This action cannot
              be undone.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={confirmDeleteContact}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Delete Contact
              </Button>
              <Button
                onClick={() => setShowDeleteModal(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-7xl mx-4 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                CSV Editor ({csvPreview.length} rows) - AI Assistant
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-4 mb-4">
              <Button
                onClick={handleImportContacts}
                className="bg-green-600 hover:bg-green-700"
              >
                Import Contacts
              </Button>
            </div>

            <div className="flex gap-4 flex-1 min-h-0">
              {/* Editable Table */}
              <div className="flex-1 overflow-auto border border-slate-300 rounded-lg">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      {csvHeaders.map((header, index) => (
                        <th
                          key={index}
                          className="border border-slate-300 px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase min-w-[120px]"
                        >
                          {editingCell &&
                          editingCell.row === -1 &&
                          editingCell.col === index ? (
                            <input
                              type="text"
                              value={header}
                              onChange={(e) => {
                                const oldHeader = csvHeaders[index];
                                const newHeader = e.target.value;

                                // Update header
                                const updatedHeaders = [...csvHeaders];
                                updatedHeaders[index] = newHeader;
                                setCsvHeaders(updatedHeaders);

                                // Update all row data to use new key
                                const updatedPreview = csvPreview.map((row) => {
                                  const newRow = { ...row };
                                  if (newRow.hasOwnProperty(oldHeader)) {
                                    newRow[newHeader] = newRow[oldHeader];
                                    delete newRow[oldHeader];
                                  }
                                  return newRow;
                                });
                                setCsvPreview(updatedPreview);
                              }}
                              onBlur={() => setEditingCell(null)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === "Escape") {
                                  setEditingCell(null);
                                }
                              }}
                              className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none text-xs uppercase font-medium"
                              autoFocus
                            />
                          ) : (
                            <div
                              className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded min-h-[24px] flex items-center"
                              onClick={() =>
                                setEditingCell({ row: -1, col: index })
                              }
                              title="Click to edit column name"
                            >
                              {header}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-slate-50">
                        {csvHeaders.map((header, colIndex) => (
                          <td
                            key={colIndex}
                            className="border border-slate-300 px-4 py-2 text-sm text-slate-900 min-w-[120px]"
                          >
                            {editingCell &&
                            editingCell.row === rowIndex &&
                            editingCell.col === header ? (
                              <input
                                type="text"
                                value={row[header] || ""}
                                onChange={(e) =>
                                  handleCellEdit(
                                    rowIndex,
                                    header,
                                    e.target.value
                                  )
                                }
                                onBlur={() => setEditingCell(null)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === "Escape") {
                                    setEditingCell(null);
                                  }
                                }}
                                className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none"
                                autoFocus
                              />
                            ) : (
                              <div
                                className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded min-h-[24px] flex items-center"
                                onClick={() =>
                                  setEditingCell({ row: rowIndex, col: header })
                                }
                              >
                                {row[header] || ""}
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* AI Chatbox */}
              <div className="w-96 border border-slate-300 rounded-lg flex flex-col">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-300">
                  <h4 className="font-medium text-slate-900 flex items-center gap-2">
                    <Bot className="w-4 h-4" />
                    AI Data Assistant
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Ask me to clean, format, or analyze your CSV data
                  </p>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-3">
                  {aiChatMessages.length === 0 && (
                    <div className="text-center text-slate-500 text-sm">
                      <p>Try asking:</p>
                      <ul className="mt-2 space-y-1">
                        <li>• "Clean phone numbers and remove + signs"</li>
                        <li>• "Identify name, title, and phone columns"</li>
                        <li>• "Remove duplicate rows"</li>
                        <li>• "Standardize name formats"</li>
                      </ul>
                    </div>
                  )}
                  {aiChatMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        message.role === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                          message.role === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-900"
                        }`}
                        style={{ whiteSpace: "pre-wrap" }}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))}
                  {aiProcessing && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 px-3 py-2 rounded-lg text-sm text-slate-900">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Thinking...
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-300 p-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiChatInput}
                      onChange={(e) => setAiChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !aiProcessing) {
                          handleAISendMessage();
                        }
                      }}
                      placeholder="Ask AI to help clean your data..."
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      disabled={aiProcessing}
                    />
                    <Button
                      onClick={handleAISendMessage}
                      disabled={aiProcessing || !aiChatInput.trim()}
                      size="sm"
                      className="px-4"
                    >
                      {aiProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Send"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
